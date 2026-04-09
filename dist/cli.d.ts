export type CliCommand = {
    type: "help";
} | {
    type: "version";
} | {
    type: "list";
} | {
    type: "switch";
    providerId: string;
    model: string | undefined;
} | null;
/**
 * Parse process.argv into a CLI command.
 * Returns null when no arguments are given (fall through to TUI).
 */
export declare function parseArgs(argv: string[]): CliCommand;
/**
 * Print version string.
 */
export declare function printVersion(): void;
/**
 * Print help / usage information.
 */
export declare function printHelp(): void;
/**
 * List all providers with their current status.
 */
export declare function runList(): Promise<void>;
/**
 * Quick-switch to a provider/model without interactive prompts.
 * Returns exit code (0 = success, 1 = error).
 */
export declare function runQuickSwitch(providerId: string, model?: string): Promise<number>;
