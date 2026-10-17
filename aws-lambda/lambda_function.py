import json, os, csv, io
import urllib.request, urllib.parse
import boto3

s3 = boto3.client("s3")


def respond(code, body):
    return {"statusCode": code,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(body)}


def lambda_handler(event, context):
    params = event.get("queryStringParameters") or {}
    city = params.get("city", "Abha")
    try:
        # Source 1: live data from OpenWeatherMap
        query = urllib.parse.urlencode({
            "q": city,
            "appid": os.environ["OPENWEATHER_API_KEY"],
            "units": "metric",
        })
        url = "https://api.openweathermap.org/data/2.5/weather?" + query
        with urllib.request.urlopen(url, timeout=8) as r:
            w = json.loads(r.read())
        live_temp = w["main"]["temp"]

        # Source 2: historical Kaggle CSV from S3
        obj = s3.get_object(Bucket=os.environ["BUCKET_NAME"],
                            Key=os.environ["CSV_KEY"])
        text = obj["Body"].read().decode("utf-8-sig", errors="replace")
        rows = [r for r in csv.DictReader(io.StringIO(text))
                if r["City"].strip().lower() in (city.lower(), "abha")
                and r["AverageTemperature"].strip()]
        if not rows:
            return respond(404, {"error": "No historical data for " + city})

        temps = [float(r["AverageTemperature"]) for r in rows]
        hist_avg = sum(temps) / len(temps)

        return respond(200, {
            "service": "GreenTech Analytics Climate Processor",
            "cloud_provider": "AWS Lambda",
            "live": {"city": city,
                     "temperature_c": live_temp,
                     "humidity_pct": w["main"]["humidity"]},
            "historical": {"records_used": len(temps),
                           "first_date": rows[0]["dt"],
                           "latest_date": rows[-1]["dt"],
                           "avg_temperature_c": round(hist_avg, 2)},
            "temperature_deviation_c": round(live_temp - hist_avg, 2),
        })
    except Exception as e:
        return respond(500, {"error": str(e)})
