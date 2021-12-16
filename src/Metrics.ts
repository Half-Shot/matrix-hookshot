import { Appservice, FunctionCallContext, METRIC_MATRIX_CLIENT_FAILED_FUNCTION_CALL, METRIC_MATRIX_CLIENT_SUCCESSFUL_FUNCTION_CALL } from "matrix-bot-sdk";
import { collectDefaultMetrics, Counter, Gauge, register, Registry } from "prom-client";
import { BridgeConfigMetrics } from "./Config/Config";
import { Response, default as expressApp } from "express";
import LogWrapper from "./LogWrapper";
import { Server } from "http";
const log = new LogWrapper("Metrics");

export class Metrics {
    private httpServer?: Server;

    public readonly webhooksHttpRequest = new Counter({ name: "hookshot_webhooks_http_request", help: "Number of requests made to the hookshot webhooks handler", labelNames: ["path", "method"], registers: [this.registry]});
    public readonly provisioningHttpRequest = new Counter({ name: "hookshot_provisioning_http_request", help: "Number of requests made to the hookshot webhooks handler", labelNames: ["path", "method"], registers: [this.registry]});

    public readonly messageQueuePushes = new Counter({ name: "hookshot_queue_event_pushes", help: "Number of events pushed through the queue", labelNames: ["event"], registers: [this.registry]});

    public readonly notificationsPush = new Counter({ name: "hookshot_notifications_push", help: "Number of notifications pushed", labelNames: ["service"], registers: [this.registry]});
    public readonly notificationsServiceUp = new Gauge({ name: "hookshot_notifications_service_up", help: "Is the notification service up or down", labelNames: ["service"], registers: [this.registry]});
    public readonly notificationsWatchers = new Gauge({ name: "hookshot_notifications_watchers", help: "Number of notifications watchers running", labelNames: ["service"], registers: [this.registry]});

    private readonly matrixApiCalls = new Counter({ name: "matrix_api_calls", help: "The number of Matrix client API calls made", labelNames: ["method"], registers: [this.registry]});
    private readonly matrixApiCallsFailed = new Counter({ name: "matrix_api_calls_failed", help: "The number of Matrix client API calls which failed", labelNames: ["method"], registers: [this.registry]});

    public readonly matrixAppserviceEvents = new Counter({ name: "matrix_appservice_events", help: "The number of events sent over the AS API", labelNames: [], registers: [this.registry]});

    constructor(private registry: Registry = register) {
        collectDefaultMetrics({
            register: this.registry
        })
    }

    public async getMetrics() {
        return this.registry.metrics();
    }


    /**
    * Registers some exported metrics that relate to operations of the embedded
    * matrix-js-sdk. In particular, a metric is added that counts the number of
    * calls to client API endpoints made by the client library.
    */
     public registerMatrixSdkMetrics(appservice: Appservice): void {
        appservice.metrics.registerListener({
            onStartMetric: () => {
                // Not used yet.
            },
            onEndMetric: () => {
                // Not used yet.
            },
            onIncrement: (metricName, context) => {
                if (metricName === METRIC_MATRIX_CLIENT_SUCCESSFUL_FUNCTION_CALL) {
                    const ctx = context as FunctionCallContext;
                    this.matrixApiCalls.inc({method: ctx.functionName});
                }
                if (metricName === METRIC_MATRIX_CLIENT_FAILED_FUNCTION_CALL) {
                    const ctx = context as FunctionCallContext;
                    this.matrixApiCallsFailed.inc({method: ctx.functionName});
                }
            },
            onDecrement: () => {
                // Not used yet.
            },
            onReset: (metricName) => {
                if (metricName === METRIC_MATRIX_CLIENT_SUCCESSFUL_FUNCTION_CALL) {
                    this.matrixApiCalls.reset();
                }
                if (metricName === METRIC_MATRIX_CLIENT_FAILED_FUNCTION_CALL) {
                    this.matrixApiCallsFailed.reset();
                }
            },
        })
    }

    private metricsFunc(_req: unknown, res: Response) {
        this.getMetrics().then(
            (m) => res.type('text/plain').send((m))
        ).catch((err) => {
            log.error('Failed to fetch metrics: ', err);
            res.status(500).send('Could not fetch metrics due to an error');
        });
    }

    public start(config: BridgeConfigMetrics, as?: Appservice) {
        if (!config.port) {
            if (!as) {
                throw Error("No metric port defined in config, and service doesn't run a appservice");
            }
            as.expressAppInstance.get('/metrics', this.metricsFunc.bind(this));
            return;
        }
        const app = expressApp();
        app.get('/metrics', this.metricsFunc.bind(this));
        this.httpServer = app.listen(config.port, config.bindAddress || "127.0.0.1");
    }

    public async stop() {
        if (!this.httpServer) {
            return;
        }
        return new Promise<void>((res, rej) => this.httpServer?.close(err => err ? rej(err) : res()));
    }
}

const singleton = new Metrics();

export default singleton;
