# OFA-Tech GitHub Workflows ⚙️

This repository contains **reusable GitHub Actions workflows** used across all OFA-Tech projects.

---

## 📦 Purpose

Centralize and standardize:

* CI/CD pipelines
* Build and test processes
* Code quality analysis (Sonar)
* Deployment automation (SFTPGo, servers, etc.)

---

## 🚀 Available Workflows

### 🔹 .NET CI (Build + Test + Sonar)

Path:

```
.github/workflows/dotnet-build-test-sonar.yml
```

Features:

* Restore, build, test
* Sonar analysis
* Artifact publishing

---

### 🔹 Deploy via SFTPGo

Path:

```
.github/workflows/deploy-sftpgo.yml
```

Features:

* Downloads build artifacts
* Uploads to SFTP server
* Supports SSH key authentication

---

## 🧩 How to Use

In your repository, create a workflow like:

```yaml
name: CI

on:
  push:
    branches: [main]

jobs:
  ci:
    uses: OFA-Tech/.github/.github/workflows/dotnet-build-test-sonar.yml@main
    with:
      project-path: "./YourSolution.sln"
      publish-path: "./out"
      artifact-name: "app"
    secrets:
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

---

## 🚚 Deployment Example

```yaml
jobs:
  deploy:
    needs: ci
    uses: OFA-Tech/.github/.github/workflows/deploy-sftpgo.yml@main
    with:
      artifact-name: "app"
      host: "your-server"
      username: "deploy-user"
      remote-path: "/apps/your-app/"
    secrets:
      SFTP_PRIVATE_KEY: ${{ secrets.SFTP_PRIVATE_KEY }}
```

---

## 🔐 Required Secrets

Depending on the workflow:

### Sonar

* `SONAR_TOKEN`
* `SONAR_HOST_URL`

### SFTP Deployment

* `SFTP_PRIVATE_KEY`

---

## 📌 Versioning

Avoid using `@main` in production.

Use tags instead:

```
@v1
@v1.1
```

---

## ⚠️ Notes

* Workflows are designed to be **generic and reusable**
* Keep app-specific logic in the calling repository
* Do not hardcode project-specific paths here

---

## 🧠 Philosophy

* DRY pipelines
* Centralized automation
* Consistent deployments
* Minimal duplication

---

> If you break this repo, you break everything. Be careful.
