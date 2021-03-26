const crypto = require("crypto");

const _ = {
  get: require("lodash.get"),
  merge: require("lodash.merge")
};
const AWS = require("aws-sdk");
const { DataSource } = require("apollo-datasource");
const { InMemoryLRUCache } = require("apollo-server-caching");

const DEFAULT_TTL = 5;

class AWSLambdaDataSource extends DataSource {
  constructor(awsOptions = {}, invokeOptions) {
    super();

    this.context = undefined;
    this.cache = undefined;
    this.lambda = new AWS.Lambda(awsOptions);
    this.invokeOptions = invokeOptions;
    this.logger = console;
  }

  initialize(config) {
    this.context = config.context;
    if (config.hasOwnProperty("cache")) {
      this.cache = _.get(config, "cache");
    } else {
      this.cache = new InMemoryLRUCache();
    }
    if (config.hasOwnProperty("logger")) {
      this.logger = _.get(config, "logger");
    } else {
      this.logger = require("console-log-level")({ level: "info" });
    }
  }

  createCacheKey(params) {
    this.logger.debug(`createCacheKey got params: ${JSON.stringify(params)}`);

    const {
      ClientContext = null,
      FunctionName,
      InvocationType = "RequestResponse",
      Payload = null,
      Qualifier = null
    } = params;

    this.logger.debug(Payload, "hashing payload");

    const hashedPayload = crypto
      .createHash("md5")
      .update(Payload)
      .digest("base64");

    const key = [
      `ClientContext:${ClientContext}`,
      `FunctionName:${FunctionName}`,
      `InvocationType:${InvocationType}`,
      `Qualifier:${Qualifier}`,
      `Payload:${hashedPayload}`
    ].join("_");

    this.logger.debug(`raw cache key = "${key}"`);

    return crypto
      .createHash("sha1")
      .update(key)
      .digest("base64");
  }

  invoke(event, ttl = DEFAULT_TTL) {
    const params = _.merge(
      {
        Payload: event
      },
      this.invokeOptions
    );
    this.logger.debug(params, "invoke params");
    const cacheKey = this.createCacheKey(params);

    return this.cache.get(cacheKey).then(entry => {
      if (entry) {
        this.logger.debug(`found in cache: ${cacheKey}`);
        return Promise.resolve(JSON.parse(entry));
      }

      return this.lambda
        .invoke(params)
        .on("success", response => {
          if (ttl === 0) {
            this.logger.debug({ key: cacheKey }, "will not cache");
            return;
          }

          this.logger.debug({ key: cacheKey, ttl }, "will cache");
          this.cache.set(cacheKey, JSON.stringify(response.data), { ttl });
        })
        .promise();
    });
  }
}

module.exports = {
  AWSLambdaDataSource
};
