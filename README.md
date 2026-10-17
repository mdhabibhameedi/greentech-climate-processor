# GreenTech Analytics Climate Processor

Modular Assignment 1, Introduction to Cloud Computing (IHC - Cloud Development).
Author: Md Habib Ahmed

A small serverless web service that combines **live weather data** (OpenWeatherMap API) with **historical temperature data** (Kaggle Earth Surface Temperature CSV) and returns the result as JSON. The same service is deployed on **AWS Lambda** and **Azure Functions** so the two providers can be compared on deployment, scalability, performance and cost.

![Architecture](docs/architecture-diagram.png)

## What it returns

`GET ...?city=Abha` returns JSON with the live temperature and humidity, the number of historical records used, the historical average, and the difference between the two.

```json
{
  "service": "GreenTech Analytics Climate Processor",
  "cloud_provider": "AWS Lambda",
  "live": { "city": "Abha", "temperature_c": 23.14, "humidity_pct": 14 },
  "historical": { "records_used": 1825, "first_date": "1861-01-01", "latest_date": "01-08-2013", "avg_temperature_c": 24.48 },
  "temperature_deviation_c": -1.34
}
```

## Repository layout

| Folder | Contents |
|---|---|
| `aws-lambda/` | Python Lambda function |
| `azure-function/` | Node.js Azure Function (`climateFunction`) |
| `load-test/` | Node.js script used for the load test |
| `docs/` | Architecture diagram |
| `screenshots/` | Evidence screenshots (AWS and Azure) |

## APIs and data used

- **OpenWeatherMap Current Weather API** (`https://api.openweathermap.org/data/2.5/weather`), needs a free API key.
- **Kaggle "Climate Change: Earth Surface Temperature Data"** (by-city file). I filtered it to the city Abha (about 101 KB), saved it as `climate.csv`, and uploaded it to S3 and Azure Blob Storage. The file is not included here, so download the dataset from Kaggle yourself.
- Columns used: `dt`, `AverageTemperature`, `City`. This dataset has no CO2 column, so CO2 is not part of this prototype.

## Setup: AWS Lambda (region eu-north-1)

1. Create an S3 bucket and upload `climate.csv`.
2. Create a Lambda function (Python 3, 128 MB) and paste in `aws-lambda/lambda_function.py`.
3. Set the timeout to 15 seconds.
4. Attach `AmazonS3ReadOnlyAccess` to the function's role.
5. Add these environment variables:

| Name | Value |
|---|---|
| `OPENWEATHER_API_KEY` | your OpenWeatherMap key |
| `BUCKET_NAME` | your bucket name |
| `CSV_KEY` | `climate.csv` |

6. Create a Function URL (auth type NONE) and add resource-based policies allowing `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` (via the Function URL).
7. Open `<function-url>/?city=Abha`.

## Setup: Azure Functions (region Central India)

1. Create a storage account and a container named `climate-data`, then upload `climate.csv`.
2. Create a Function App (Consumption plan, Node.js 22). Python was not available on the plan my free trial allowed.
3. Add these app settings:

| Name | Value |
|---|---|
| `OPENWEATHER_API_KEY` | your OpenWeatherMap key |
| `STORAGE_CONNECTION_STRING` | the storage account connection string |

4. Create an HTTP-trigger function called `climateFunction` and paste in `azure-function/climateFunction/index.js`.
5. The code needs the `@azure/storage-blob` package (listed in `azure-function/package.json`). I installed it with `npm install` from the Kudu console in `site/wwwroot`.
6. Open `https://<your-app>.azurewebsites.net/api/climateFunction?city=Abha`.

## Load test

`load-test/loadtest.js` sends 50 requests, 10 at a time, to each endpoint. Put your own URLs in the file and run `node loadtest.js`. It ran from my own computer, so distance to each region affects the numbers.

| Metric | AWS run 1 | AWS run 2 | Azure run 1 | Azure run 2 |
|---|---|---|---|---|
| Average | 642 ms | 504 ms | 2,928 ms | 360 ms |
| Median | 339 ms | 348 ms | 186 ms | 208 ms |
| Slowest | 2,201 ms | 1,057 ms | 16,217 ms | 2,292 ms |
| Errors | 0 | 0 | 0 | 0 |

Run 1 includes cold starts. See the report for the full comparison.

## Security notes

- HTTPS is used on both platforms. API keys and connection strings are stored as environment variables / app settings and are **not** in this repository.
- The AWS endpoint is anonymous over HTTPS. On Azure I enabled built-in sign-in (OAuth 2.0 / OpenID Connect with Microsoft Entra ID) after testing, so the live Azure link asks for a Microsoft login.
- My Lambda role also has `PowerUserAccess`. In production it should be least privilege (S3 read-only plus logging).

## Known issues

- Application Insights recorded 2 failed Azure invocations that I could not trace in the portal. My load test script saw 0 errors.
- Dates in the CSV use mixed formats (for example `1861-01-01` and `01-08-2013`). This does not affect the average.
