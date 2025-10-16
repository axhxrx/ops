/**
 Global configuration context for config operations

 This module provides a global namespace setting that can be configured once at app startup and used by all config operations unless overridden.

 @example
 ```typescript
 // At app startup
 setConfigNamespace('my-app');

 // Later, all config ops use 'my-app' by default
 const readOp = new ReadConfigOp('ui-language');
 // Reads from ~/.config/my-app/ui-language.jsonctc

 // Can still override per-op
 const readOp2 = new ReadConfigOp('ui-language', {
   namespace: 'other-app'
 });
 ```
 */

export interface ConfigContext
{
  namespace: string;
}

const defaultConfigContext: ConfigContext = {
  namespace: 'com.axhxrx.ops',
};

let globalConfigContext: ConfigContext = { ...defaultConfigContext };

/**
 Set the global config namespace

 This should typically be called once at app startup. All subsequent config operations will use this namespace unless explicitly overridden.

 @param namespace - The namespace to use (e.g., 'my-app', 'com.example.myapp')

 @example
 ```typescript
 // At app startup
 setConfigNamespace('my-app');
 ```
 */
export function setConfigNamespace(namespace: string): void
{
  globalConfigContext.namespace = sanitizeNamespace(namespace);
}

/**
 Get the current global config namespace

 @returns The current namespace
 */
export function getConfigNamespace(): string
{
  return globalConfigContext.namespace;
}

/**
 Reset the global config context to defaults

 Useful for testing.
 */
export function resetConfigContext(): void
{
  globalConfigContext = { ...defaultConfigContext };
}

/**
 Sanitize a namespace string to ensure it's filesystem-safe

 Allows dots for Java-style reverse domain notation (e.g., com.axhxrx.ops)

 @param namespace - The namespace to sanitize
 @returns Sanitized namespace
 */
export function sanitizeNamespace(namespace: string): string
{
  return namespace.replace(/[^a-zA-Z0-9.-]/g, '-');
}

/**
 Sanitize a config key to ensure it's filesystem-safe

 @param key - The key to sanitize
 @returns Sanitized key
 */
export function sanitizeKey(key: string): string
{
  return key.replace(/[^a-zA-Z0-9._-]/g, '-');
}
