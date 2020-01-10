const crypto = require("crypto");

const _ = require("lodash");
const AWS = require("aws-sdk");
const { DataSource } = require("apollo-datasource");
const { InMemoryLRUCache } = require("apollo-server-caching");
const bunyan = require("bunyan");

const DEFAULT_TTL = 5;

const { DEBUG } = process.env;

const logger = bunyan.createLogger({
  name: "AWSLambdaDataSource",
  level: _.get(process.env, "LOG_LEVEL", "INFO")
});

class AWSLambdaDataSource extends DataSource {
  constructor(awsOptions = {}, invokeOptions) {
    super();

    if (DEBUG && !_.has(awsOptions, "logger")) {
      awsOptions["logger"] = bunyan.createLogger({
        name: "AWSLambda",
        level: "DEBUG"
      });
    }

    this.context;
    this.cache;
    this.lambda = new AWS.Lambda(awsOptions);
    this.invokeOptions = invokeOptions;
  }

  initialize(config) {
    this.context = config.context;
    this.cache = config.cache || new InMemoryLRUCache();
  }

  createCacheKey(params) {
    logger.debug(`createCacheKey got params: ${JSON.stringify(params)}`);

    const {
      ClientContext = null,
      FunctionName,
      InvocationType = "RequestResponse",
      Payload = null,
      Qualifier = null
    } = params;

    logger.debug(Payload, "hashing payload");

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

    logger.debug(`raw cache key = "${key}"`);

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
    logger.debug(params, "invoke params");
    const cacheKey = this.createCacheKey(params);

    return this.cache.get(cacheKey).then(entry => {
      if (entry) {
        logger.debug(`found in cache: ${cacheKey}`);
        return Promise.resolve(JSON.parse(entry));
      }

      return this.lambda
        .invoke(params)
        .on("success", response => {
          if (ttl === 0) {
            logger.debug("will not cache");
            return;
          }

          logger.debug(response.data, "will cache");
          this.cache.set(cacheKey, JSON.stringify(response.data), { ttl: ttl });
        })
        .promise();
    });
  }
}

module.exports = {
  AWSLambdaDataSource
};
