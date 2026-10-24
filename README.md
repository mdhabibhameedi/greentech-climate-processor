# EcoBuy — Auto-Scaling Compute on AWS

**Modular Assignment 2 | IHC – Cloud Development**  
**Author:** Md Habib Ahmed  
**Region:** AWS Europe (Stockholm), `eu-north-1`  
**Status:** Completed demonstration; all AWS resources were deleted after testing to avoid ongoing charges. **There is no live endpoint.**

EcoBuy is a small Flask-based catalogue application deployed on Amazon EC2 behind an Application Load Balancer (ALB). An EC2 Auto Scaling Group (ASG) maintained a minimum of two instances across two Availability Zones and scaled up to five instances under CPU-intensive load. The infrastructure was configured in the AWS Console; this repository provides the application, bootstrap script, recorded settings, synthetic datasets, load-test script, screenshots, and assignment report. **It does not contain Terraform or currently deployed infrastructure.**

![EcoBuy AWS architecture](docs/modular2-architecture.png)

## Project contents

| Location | Purpose |
|---|---|
| [`app/app.py`](app/app.py) | Flask catalogue, health check, JSON API, and CPU-work endpoint |
| [`app/user-data.sh`](app/user-data.sh) | EC2 launch-template bootstrap and systemd service setup |
| [`config/aws-console-settings.md`](config/aws-console-settings.md) | Recorded AWS resource settings and scaling policy |
| [`datasets/traffic.csv`](datasets/traffic.csv) | Synthetic seven-day hourly traffic scenario |
| [`datasets/metrics.json`](datasets/metrics.json) | Synthetic hourly CPU and memory observations |
| [`datasets/generate_datasets.py`](datasets/generate_datasets.py) | Reproducible synthetic-data generator |
| [`load-test/loadtest2.js`](load-test/loadtest2.js) | Live HTTP load generator for the deployed ALB |
| [`docs/modular2-architecture.png`](docs/modular2-architecture.png) | System architecture diagram |
| [`screenshots/`](screenshots/) | 28 screenshots of configuration, deployment, tests, scaling, and costs |
| [`docs/Compute Solution-M2-Report.docx`](docs/Compute%20Solution-M2-Report.docx) | Final formatted four-page assignment report |


## Architecture and AWS configuration

- **Compute:** Amazon Linux 2023 EC2 `t3.micro` instances running Flask through Gunicorn, provisioned by a launch template.
- **Traffic distribution:** Internet-facing Application Load Balancer, HTTP listener on port 80, target-group health checks at `/health`.
- **Availability:** Two Availability Zones (`eu-north-1a`, `eu-north-1b`).
- **Auto scaling:** Desired/minimum **2** instances, maximum **5**; CPU target-tracking policy at **70%**, with **300-second** warm-up and scale-in enabled.
- **Observability:** EC2/ASG metrics and CPU-based CloudWatch alarms. Application logs were not centrally shipped to CloudWatch.

See [`config/aws-console-settings.md`](config/aws-console-settings.md) for the settings recorded during the deployment. The diagram illustrates the intended design; actual observed behavior is distinguished below.

## Application endpoints

| Route | Behavior |
|---|---|
| `/` | Product catalogue and responding instance ID |
| `/health` | Returns `ok` for ALB target health checks |
| `/api/products` | JSON product list and responding instance ID |
| `/work` | Approximately 200 ms of CPU work per request, used to create test load |

## Recreate the demonstration (optional; AWS charges may apply)

1. Review the settings in [`config/aws-console-settings.md`](config/aws-console-settings.md), and create the launch template and security group in `eu-north-1`. Use [`app/user-data.sh`](app/user-data.sh) as EC2 user data.
2. Create an HTTP target group with `/health` checks, an internet-facing ALB across two Availability Zones, and an ASG attached to that target group.
3. Set ASG desired/minimum capacity to 2 and maximum to 5; configure CPU target tracking at 70% with a 300-second warm-up.
4. After targets become healthy, visit `http://<YOUR-ALB-DNS>/` and `http://<YOUR-ALB-DNS>/api/products` to verify the app. The JSON includes `served_by` to identify responding instances.
5. With Node.js installed locally, run:

   ```bash
   node load-test/loadtest2.js http://<YOUR-ALB-DNS>
   ```

   The script runs **60 seconds at concurrency 2**, **1,200 seconds at concurrency 40**, then **120 seconds at concurrency 2**, reporting 10-second intervals. It generates **live requests to the ALB**, not requests replayed from `traffic.csv`.
6. Observe target health, ASG capacity, CloudWatch CPU graphs, and alarms. When finished, delete billable AWS resources, including the ALB, ASG, and associated instances.

**Security:** The original coursework demonstration used public HTTP and a web-instance security group accepting port 80 from anywhere. A production deployment should terminate HTTPS at the ALB, restrict instance ingress to the ALB security group, apply least-privilege IAM, and centralize logs. No SSH ingress was configured in the recorded security-group settings.

## Synthetic datasets versus actual measurements

The two datasets are **illustrative, generated data**, not customer telemetry or AWS CloudWatch exports. [`generate_datasets.py`](datasets/generate_datasets.py) produces **168 hourly records** over seven days, including a simulated sale spike. The recorded dataset peaks at **4,867 hourly hits** and **97% simulated CPU**. These values **do not measure the deployed EC2 instances** and **do not control the Node.js load generator**.

The load-test console output and AWS Console screenshots separately document the live demonstration.

## Observed load-test results

| Metric | Run 1: 2 instances, scaling not observed | Run 2: after scale-out to 5 instances |
|---|---:|---:|
| Average spike response time | Approximately **2,010 ms** | Approximately **805 ms** |
| Requests per 10 seconds during spike | Approximately **200** | Approximately **497** |
| Script-reported request errors | **0** | **0** |
| Quiet-phase average response time | Approximately **370–430 ms** | Approximately **335 ms** |

These observations correspond to roughly **60% lower average spike latency** and **149% more requests per 10 seconds** in the recorded comparison. They are **not a controlled benchmark**: the two runs had different ASG policy states, and the five-instance figures were taken near the end of the second spike. They should not be interpreted as a guaranteed performance improvement or a precise scaling-efficiency measurement.

During the first run, the group stayed at two instances. The scaling policy was not visible when checked afterward, so the `ecobuy-cpu-70` policy was created before the second run. During run 2, a CloudWatch high-CPU alarm accompanied scale-out from **2 → 3 → 5** instances. Subsequent instance-list screenshots showed a reduction from five toward the two-instance minimum. The ASG Activity entries explaining scale-in were not preserved.

**Evidence:** See [`screenshots/`](screenshots/), particularly `m2-11-scaling-policy.png`, `m2-12-scale-out.png`, `m2-13-alarm.png`, `m2-16-capacity-graph.png`, `m2-19-loadtest-results.png`, `m2-22-scaling-in.png`, and `m2-25-scale-out-max-5.png`.

## Monitoring and limitations

CloudWatch CPU graphs, target-tracking alarms, and ASG metrics were used to observe scaling. **No custom CloudWatch dashboard or centralized application-log collection was implemented**; application logs remained on the EC2 instances. The screenshots document healthy targets and instance-count changes, but **no controlled instance-failure recovery test** was performed. Scale-in is supported by instance lists rather than a complete ASG Activity audit trail.

## Costs and teardown

The recorded estimate for two always-running `t3.micro` instances plus the ALB was approximately **US$38.80/month** in Stockholm; an illustrative five-instance configuration was estimated at roughly **US$62/month**. These are **estimates, not actual monthly bills**. A Cost Explorer screenshot showed approximately **US$0.34** of account-level charges at the time of observation; that figure is **not isolated to this project**.

**All AWS resources used for the demonstration were subsequently deleted.** The former ALB URL is inactive, and no live service or AWS account access is supplied with this repository. Recreating the system may incur charges.

## Assignment evidence and documentation

- [Four-page formatted assignment report](docs/Compute%20Solution-M2-Report.docx)
- [Architecture diagram](docs/modular2-architecture.png)
- [AWS Console setup notes](config/aws-console-settings.md)
- [All 28 evidence screenshots](screenshots/)

This repository records a completed educational prototype, including its limitations; it is **not** a production-ready deployment.
