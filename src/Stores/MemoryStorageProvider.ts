import { MemoryStorageProvider as MSP } from "matrix-bot-sdk";
import { IBridgeStorageProvider } from "./StorageProvider";
import { IssuesGetResponseData } from "../github/Types";
import { ProvisionSession } from "matrix-appservice-bridge";
import QuickLRU from "@alloc/quick-lru";
import { SerializedGitlabDiscussionThreads } from "../Connections";

export class MemoryStorageProvider extends MSP implements IBridgeStorageProvider {
    private issues: Map<string, IssuesGetResponseData> = new Map();
    private issuesLastComment: Map<string, string> = new Map();
    private reviewData: Map<string, string> = new Map();
    private figmaCommentIds: Map<string, string> = new Map();
    private widgetSessions: Map<string, ProvisionSession> = new Map();
    private storedFiles = new QuickLRU<string, string>({ maxSize: 128 });
    private gitlabDiscussionThreads = new Map<string, SerializedGitlabDiscussionThreads>();

    constructor() {
        super();
    }
    connect?(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    disconnect?(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    public async setGithubIssue(repo: string, issueNumber: string, data: IssuesGetResponseData, scope = "") {
        this.issues.set(`${scope}${repo}/${issueNumber}`, data);
    }

    public async getGithubIssue(repo: string, issueNumber: string, scope = "") {
        return this.issues.get(`${scope}${repo}/${issueNumber}`) || null;
    }

    public async setLastNotifCommentUrl(repo: string, issueNumber: string, url: string, scope = "") {
        this.issuesLastComment.set(`${scope}${repo}/${issueNumber}`, url);
    }

    public async getLastNotifCommentUrl(repo: string, issueNumber: string, scope = "") {
        return this.issuesLastComment.get(`${scope}${repo}/${issueNumber}`) || null;
    }

    public async setPRReviewData(repo: string, issueNumber: string, data: any, scope = "") {
        const key = `${scope}:${repo}/${issueNumber}`;
        this.reviewData.set(key, data);
    }

    public async getPRReviewData(repo: string, issueNumber: string, scope = "") {
        const key = `${scope}:${repo}/${issueNumber}`;
        return this.reviewData.get(key) || null;
    }

    private static figmaCommentKey(roomId: string, figmaCommentId: string) {
        return `${roomId}:${figmaCommentId}`;
    }

    public async setFigmaCommentEventId(roomId: string, figmaCommentId: string, eventId: string) {
        this.figmaCommentIds.set(MemoryStorageProvider.figmaCommentKey(roomId, figmaCommentId), eventId);
    }

    public async getFigmaCommentEventId(roomId: string, figmaCommentId: string) {
        return this.figmaCommentIds.get(MemoryStorageProvider.figmaCommentKey(roomId, figmaCommentId)) || null;
    }

    public async getSessionForToken(token: string) {
       return this.widgetSessions.get(token) || null;
    }
    public async createSession(session: ProvisionSession) {
        this.widgetSessions.set(session.token, session);
    }
    public async  deleteSession(token: string) {
        this.widgetSessions.delete(token);
    }
    public async deleteAllSessions(userId: string) {
        [...this.widgetSessions.values()]
            .filter(s => s.userId === userId)
            .forEach(s => this.widgetSessions.delete(s.token));
    }

    public async getStoredTempFile(key: string): Promise<string|null> {
        return this.storedFiles.get(key) ?? null;
    }
    
    public async setStoredTempFile(key: string, value: string) {
        this.storedFiles.set(key, value);
    }

    public async getGitlabDiscussionThreads(connectionId: string): Promise<SerializedGitlabDiscussionThreads> {
        return this.gitlabDiscussionThreads.get(connectionId) ?? [];
    }

    public async setGitlabDiscussionThreads(connectionId: string, value: SerializedGitlabDiscussionThreads): Promise<void> {
        this.gitlabDiscussionThreads.set(connectionId, value);
    }
}