import { Logger } from "matrix-appservice-bridge";
import { Appservice, IAppserviceCryptoStorageProvider, IAppserviceRegistration, RustSdkAppserviceCryptoStorageProvider, RustSdkCryptoStoreType } from "matrix-bot-sdk";
import { BridgeConfig } from "./config/Config";
import Metrics from "./Metrics";
import { MemoryStorageProvider } from "./stores/MemoryStorageProvider";
import { RedisStorageProvider } from "./stores/RedisStorageProvider";
import { IBridgeStorageProvider } from "./stores/StorageProvider";
const log = new Logger("Appservice");

export function getAppservice(config: BridgeConfig, registration: IAppserviceRegistration) {
    let storage: IBridgeStorageProvider;
    if (config.queue.host && config.queue.port) {
        log.info(`Initialising Redis storage (on ${config.queue.host}:${config.queue.port})`);
        storage = new RedisStorageProvider(config.queue.host, config.queue.port);
    } else {
        log.info('Initialising memory storage');
        storage = new MemoryStorageProvider();
    }

    let cryptoStorage: IAppserviceCryptoStorageProvider | undefined;
    if (config.encryption?.storagePath) {
        log.info('Initialising crypto storage')
        cryptoStorage = new RustSdkAppserviceCryptoStorageProvider(
            config.encryption.storagePath,
            RustSdkCryptoStoreType.Sqlite,
        );
    }

    const appservice = new Appservice({
        homeserverName: config.bridge.domain,
        homeserverUrl: config.bridge.url,
        port: config.bridge.port,
        bindAddress: config.bridge.bindAddress,
        registration: {
            ...registration,
            namespaces: {
                // Support multiple users
                users: [{
                    regex: '(' + registration.namespaces.users.map((r) => r.regex).join(')|(') + ')',
                    exclusive: true,
                }],
                aliases: registration.namespaces.aliases,
                rooms: registration.namespaces.rooms,
            }
        },
        storage: storage,
        intentOptions: {
            encryption: !!config.encryption,
        },
        cryptoStorage: cryptoStorage,
    });

    Metrics.registerMatrixSdkMetrics(appservice);

    return {appservice, storage, cryptoStorage};
}