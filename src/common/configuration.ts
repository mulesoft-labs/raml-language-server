/**
 * Configuration of actions module.
 */
export interface IActionsConfiguration {

    /**
     * Whether to report actions that require external UI in action-related searches.
     */
    enableUIActions?: boolean;
}

export interface IModulesConfiguration {

    /**
     * If true, will make Details module enabled, false otherwise, if absent, make no changes.
     */
    enableDetailsModule?: boolean;

    /**
     * If true, will make Custom Actions module enabled, false otherwise, if absent, make no changes.
     */
    enableCustomActionsModule?: boolean;
}

/**
 * Server configuration.
 */
export interface IServerConfiguration {

    /**
     * Sets custom actions module configuration.
     */
    actionsConfiguration?: IActionsConfiguration;

    /**
     * Sets server modules configuration.
     */
    modulesConfiguration?: IModulesConfiguration;
}
