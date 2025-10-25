#!/usr/bin/env bun

import type { IOContext } from './IOContext.ts';
import { Op } from './Op.ts';
import { ShowTableOp } from './ShowTableOp.tsx';
import type { TableData, TableRow } from './ShowTableOp.tsx';

/**
 * Abstract base class for browser-style ops (filesystem, S3, FTP, etc.)
 *
 * This extracts the common navigation and selection logic shared by all browser ops.
 * Subclasses only need to implement data fetching and navigation specifics.
 *
 * Type parameters:
 * - TEntry: Entry type (FileSystemEntry, S3Entry, etc.)
 * - TListing: Listing type with toTableData() method (DirectoryListing, S3Listing, etc.)
 * - TSelectionMode: Selection mode type union
 * - TSuccessValue: Return type (TEntry or TEntry[])
 * - TFailureType: Failure type union
 */
export abstract class BrowserOpBase<
  TEntry,
  TListing extends { toTableData(includeParent: boolean): TableData; entries: TEntry[] },
  TSelectionMode extends string,
  TSuccessValue,
  TFailureType extends string,
> extends Op
{
  /**
   * Track selected entries for multi-select mode
   */
  protected selectedEntries: Set<string> = new Set();

  /**
   * Main run method - implements the entire navigation loop
   * This is the ~150 lines of code that was duplicated!
   */
  async run(
    io?: IOContext,
  ): Promise<{ ok: true; value: TSuccessValue } | { ok: false; failure: TFailureType; debugData?: string }>
  {
    // Optional hook for subclasses (e.g., S3 credentials)
    const setupResult = await this.beforeRun(io);
    if (setupResult && !setupResult.ok)
    {
      return setupResult;
    }

    const selectionMode = this.getSelectionMode();
    const isMultiSelect = this.isMultiSelectMode(selectionMode);

    // Keep navigating until user selects or cancels
    let errorMsg: string | null = null;

    while (true)
    {
      // Fetch listing using subclass implementation
      const listResult = await this.fetchListing(io);

      if (!listResult.ok)
      {
        // Map listing failures to browser failures
        return listResult as never;
      }

      const listing = listResult.value;

      // Apply custom filters (subclass can override)
      const filteredListing = this.applyCustomFilter(listing);
      const entries = filteredListing.entries;

      // Create table data from listing
      const tableData = this.createTableData(filteredListing);

      // Get title from subclass
      const title = this.getTitle();

      // Show table with appropriate mode
      const tableOp = new ShowTableOp({
        mode: isMultiSelect ? 'select-multi' : 'select-row',
        dataProvider: tableData,
        cancelable: this.isCancelable(),
        title,
        errorMessage: errorMsg,
        fillHeight: true,
        customKeyHandler: (input, key, currentRow) =>
        {
          // Right arrow: navigate into directories
          if (key.rightArrow)
          {
            const name = currentRow.data.name as string;
            const entry = entries.find((e) => this.getEntryName(e) === name);

            if (entry && this.isDirectory(entry))
            {
              return { handled: true, action: 'navigate', row: currentRow };
            }
          }

          return { handled: false };
        },
      });
      const tableResult = await tableOp.run(io);

      // Clear error after showing it once
      errorMsg = null;

      if (!tableResult.ok)
      {
        // User canceled or error occurred
        return tableResult as never;
      }

      // Handle selection with proper discriminated union type checking
      const result = tableResult.value;

      switch (result.type)
      {
        case 'navigate':
        {
          // Navigation action from custom key handler (e.g., right arrow)
          const name = result.row.data.name as string;
          const entry = entries.find((e) => this.getEntryName(e) === name);

          if (entry)
          {
            this.navigateInto(entry);
          }
          continue;
        }

        case 'row-selected':
        {
          // Single row selected with Enter key
          const name = result.row.data.name as string;

          // Handle special ".." entry
          if (name === '..')
          {
            this.navigateUp();
            continue;
          }

          const entry = entries.find((e) => this.getEntryName(e) === name);

          if (!entry)
          {
            this.warn(io, 'Selected entry not found');
            continue;
          }

          // If it's a directory, handle directory selection or navigation
          if (this.isDirectory(entry))
          {
            if (this.isDirectorySelectionMode(selectionMode))
            {
              // User wants to select this directory
              return this.succeed(entry as never);
            }
            else
            {
              // Descend into directory
              this.navigateInto(entry);
              continue;
            }
          }

          // It's a file or other entry - validate and return
          const isValid = this.validateSingleSelection(entry, selectionMode);

          if (!isValid)
          {
            errorMsg = this.getValidationMessage(selectionMode);
            continue;
          }

          return this.succeed(entry as never);
        }

        case 'rows-selected':
        {
          // Multi-select mode - validate and return selected entries
          const validationResult = this.handleMultiSelect(
            result.rows,
            entries,
            selectionMode,
          );

          if (validationResult.type === 'error')
          {
            errorMsg = validationResult.message;
            continue;
          }

          return this.succeed(validationResult.value as never);
        }

        case 'display-closed':
        {
          // This shouldn't happen in browser context, but TypeScript forces us to handle it
          // This is GOOD - it's exhaustive checking!
          this.warn(io, 'Display closed in browser mode - unexpected');
          continue;
        }
      }
    }
  }

  // ==================== ABSTRACT METHODS - Subclasses must implement ====================

  /**
   * Fetch listing for current location (directory/prefix)
   * Called on each iteration of navigation loop
   */
  protected abstract fetchListing(io?: IOContext): Promise<
    | { ok: true; value: TListing }
    | { ok: false; failure: TFailureType; debugData?: string }
  >;

  /**
   * Navigate up one level (parent directory/prefix)
   */
  protected abstract navigateUp(): void;

  /**
   * Navigate into a directory entry
   */
  protected abstract navigateInto(entry: TEntry): void;

  /**
   * Whether to show ".." parent entry in current location
   */
  protected abstract shouldShowParentEntry(): boolean;

  /**
   * Get title for ShowTableOp display
   */
  protected abstract getTitle(): string;

  /**
   * Get the selection mode from options
   */
  protected abstract getSelectionMode(): TSelectionMode;

  /**
   * Whether cancelable is enabled
   */
  protected abstract isCancelable(): boolean;

  /**
   * Get entry name for matching with table rows
   */
  protected abstract getEntryName(entry: TEntry): string;

  /**
   * Check if entry is a directory
   */
  protected abstract isDirectory(entry: TEntry): boolean;

  /**
   * Validate single selection based on mode
   */
  protected abstract validateSingleSelection(entry: TEntry, mode: TSelectionMode): boolean;

  /**
   * Validate multi selection based on mode
   */
  protected abstract validateMultiSelection(entries: TEntry[], mode: TSelectionMode): boolean;

  /**
   * Get validation error message for mode
   */
  protected abstract getValidationMessage(mode: TSelectionMode): string;

  /**
   * Check if selection mode is for directory selection
   */
  protected abstract isDirectorySelectionMode(mode: TSelectionMode): boolean;

  // ==================== CONCRETE METHODS - Implemented in base class ====================

  /**
   * Optional hook called before main navigation loop starts
   * Subclasses can override for setup (e.g., S3 credentials)
   *
   * Return an Outcome to abort, or void/undefined to continue
   */
  protected async beforeRun(
    _io?: IOContext,
  ): Promise<{ ok: false; failure: TFailureType; debugData?: string } | void>
  {
    // Default: no setup needed
    await Promise.resolve();
    return undefined;
  }

  /**
   * Apply custom filtering to listing
   * Subclasses can override to apply custom filters
   */
  protected applyCustomFilter(listing: TListing): TListing
  {
    // Default: no filtering
    return listing;
  }

  /**
   * Create table data from listing
   * Uses the listing's toTableData() method
   */
  protected createTableData(listing: TListing): TableData
  {
    const includeParent = this.shouldShowParentEntry();
    return listing.toTableData(includeParent);
  }

  /**
   * Check if selection mode is multi-select
   */
  protected isMultiSelectMode(mode: TSelectionMode): boolean
  {
    return mode.toString().startsWith('multi-');
  }

  /**
   * Handle multi-select logic
   * Returns either error message or selected entries
   */
  protected handleMultiSelect(
    selectedRows: TableRow[],
    entries: TEntry[],
    selectionMode: TSelectionMode,
  ):
    | { type: 'error'; message: string }
    | { type: 'success'; value: TEntry[] }
  {
    if (selectedRows.length === 0)
    {
      return {
        type: 'error',
        message: 'No items selected.\nPlease select at least one item with Space, then press Enter.',
      };
    }

    // Map selected rows back to entry objects
    const selectedEntries = selectedRows
      .map((row) =>
      {
        const name = row.data.name;
        return entries.find((e) => this.getEntryName(e) === name);
      })
      .filter((e): e is TEntry => e !== undefined);

    // Validate selection based on mode
    const isValid = this.validateMultiSelection(selectedEntries, selectionMode);

    if (!isValid)
    {
      return {
        type: 'error',
        message: this.getValidationMessage(selectionMode),
      };
    }

    return {
      type: 'success',
      value: selectedEntries,
    };
  }
}
