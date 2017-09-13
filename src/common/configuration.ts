/**
 * Configuration of actions module.
 */
export interface IActionsConfiguration {

    /**
     * Whether to report actions that require external UI in action-related searches.
     */
    enableUIActions?: boolean;
}

/**
 * Server configuration.
 */
export interface IServerConfiguration {

    actionsConfiguration?: IActionsConfiguration;
}
