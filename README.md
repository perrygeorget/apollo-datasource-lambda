# AWSLambdaDataSource

Use [AWS Lambda](https://aws.amazon.com/lambda/) as an [Apollo DataSources](https://www.apollographql.com/docs/apollo-server/features/data-sources.html).

Based on [SQLDataSource](https://github.com/cvburgess/SQLDataSource).

## Installation

To install AWSLambdaDataSource:

```bash
npm i apollo-datasource-lambda
```

Or if you prefer yarn

```bash
yarn add apollo-datasource-lambda
```

## Usage

`invoke(payload, ttl = 5)`:

`payload`: Buffer.from('...') || 'STRING_VALUE' **Strings will be Base-64 encoded on your behalf**

`ttl`: the number of seconds to retain the data in the cache (DEFAULT: 5)

Configure Apollo:

```javascript
const { AWSLambdaDataSource } = require("apollo-datasource-lambda");

const lambdaAwesome = new AWSLambdaDataSource(
  { region: "us-west-2" },
  { FunctionName: "my-awesome-function" }
);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cache,
  context,
  dataSources: () => ({ lambdaAwesome })
});
```

Use:

```javascript
const TTL_ONE_MINUTE = 60;

class Awesome {
  static async getAwesomeMessage(source, args, { dataSources }) {
    const event = {
      question: "What is the meaning of life?"
    };

    // Returns Promise as if you called AWS.Lambda().invoke().promise()
    const response = await dataSources.lambdaAwesome.invoke(
      JSON.stringify(event),
      TTL_ONE_MINUTE
    );

    return response["Payload"];
  }
}

module.exports = Awesome;
```

## Configuration

If no cache is provided in your Apollo server configuration,
AWSLambdaDataSource falls back to the same InMemoryLRUCache leveraged by Apollo's [RESTDataSource](https://www.apollographql.com/docs/apollo-server/data/data-sources/#rest-data-source).

## Instance Variables

### context

The context from your Apollo server.

### lambda

The [`AWS.Lambda`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html) instance.
