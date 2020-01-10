const AWS = require("aws-sdk");
const { AWSLambdaDataSource } = require("./index");

const awsOptions = { region: "us-west-2" };
const invokeOptions = { FunctionName: "dummy-function" };
const mockData = {
  FunctionName: "dummy-function",
  InvocationType: "RequestResponse",
  Payload: { data: "data" }
};
// TODO: mock AWS.Response instance's data attribute with our data.

const cache = {
  get: jest.fn(() => {
    console.log("cache.get called");

    return Promise.resolve(null);
  }),
  set: jest.fn(() => {
    console.log("cache.set called");
  })
};

describe("jest", () => {
  beforeEach(() => {
    AWS.Lambda = function() {
      return {
        invoke: () => ({
          on: (event, callback) => {
            if ("undefined" !== typeof callback && event === "success") {
              callback(mockData);
            }
            return {
              promise: () => {
                return Promise.resolve(mockData);
              }
            };
          }
        })
      };
    };

    cache.get.mockClear();
    cache.set.mockClear();
  });

  it("invoke and cache", async () => {
    const datasource = new AWSLambdaDataSource(awsOptions, invokeOptions);
    datasource.initialize({ cache });
    const response = await datasource.invoke(
      JSON.stringify({ event: "hello" }),
      5
    );

    expect(response).toEqual(mockData);
    expect(cache.set).toBeCalled();
  });

  it("invoke do not cache", async () => {
    const datasource = new AWSLambdaDataSource(awsOptions, invokeOptions);
    datasource.initialize({ cache });
    const response = await datasource.invoke(
      JSON.stringify({ event: "hello" }),
      0
    );

    expect(response).toEqual(mockData);
    expect(cache.set).not.toBeCalled();
  });

  it("invoke do not alter invokeOptions", async () => {
    const datasource = new AWSLambdaDataSource(awsOptions, invokeOptions);
    datasource.initialize({ cache });
    const response = await datasource.invoke(
      JSON.stringify({ event: "hello" }),
      0
    );

    expect(datasource.invokeOptions).not.toHaveProperty("Payload");
  });
});
