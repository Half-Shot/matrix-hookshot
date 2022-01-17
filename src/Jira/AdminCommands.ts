import { AdminRoomCommandHandler } from "../AdminRoomCommandHandler";
import { botCommand } from "../BotCommands";
import qs from "querystring";
import { JiraAPIAccessibleResource } from "./Types";
import LogWrapper from "../LogWrapper";

const log = new LogWrapper('JiraBotCommands');

const JiraOAuthScopes = [
    // Reading issues, comments
    "read:jira-work",
    // Creating issues, comments
    "write:jira-work",
    // Reading user
    "read:jira-user",
    "read:me",
    "read:account",
    // To get a refresh token
    "offline_access",
];

export function generateJiraURL(clientId: string, redirectUri: string, state: string) {
    const options = {
        audience: "api.atlassian.com",
        client_id: clientId,
        scope: JiraOAuthScopes.join(" "),
        redirect_uri: redirectUri,
        state: state,
        response_type: "code",
        prompt: "consent",
    };
    return `https://auth.atlassian.com/authorize?${qs.stringify(options)}`;
}

export class JiraBotCommands extends AdminRoomCommandHandler {
    @botCommand("jira login", {help: "Login to JIRA", category: "jira"})
    public async loginCommand() {
        if (!this.config.jira?.oauth) {
            this.sendNotice(`Bot is not configured with JIRA OAuth support`);
            return;
        }
        const cfg = this.config.jira.oauth;
        const state = this.tokenStore.createStateForOAuth(this.userId);
        await this.sendNotice(`To login, open ${generateJiraURL(cfg.client_id, cfg.redirect_uri, state)} to link your account to the bridge`);
    }

    @botCommand("jira whoami", {help: "Determine JIRA identity", category: "jira"})
    public async whoami() {
        if (!this.config.jira) {
            await this.sendNotice(`Bot is not configured with JIRA OAuth support`);
            return;
        }
        const client = await this.tokenStore.getJiraForUser(this.userId);
        
        if (!client) {
            await this.sendNotice(`You are not logged into JIRA`);
            return;
        }
        // Get all resources for user
        let resources: JiraAPIAccessibleResource[];
        try {
            resources = await client.getAccessibleResources();
        } catch (ex) {
            log.warn(`Could not request resources from JIRA API: `, ex);
            await this.sendNotice(`Could not request JIRA resources due to an error`);
            return;
        }
        let response = resources.length === 0 ?  `You do not have any instances authorised with this bot` : 'You have access to the following instances:';
        for (const resource of resources) {
            const user = await (await client.getClientForResource(resource)).getCurrentUser();
            response += `\n - ${resource.name} ${user.name} (${user.displayName || ""})`;
        }
        await this.sendNotice(response);
    }
}
