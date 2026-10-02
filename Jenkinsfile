pipeline {
  agent any

  environment {
    APP_NAME      = 'cashrunway-api'
    IMAGE_TAG     = "${env.BUILD_NUMBER}"
    RELEASE_TAG   = "stable"
    // Separate Docker Compose project names keep the staging, production and
    // monitoring stacks isolated. Without these they share a project name
    // derived from the workspace folder and tear each other down.
    STAGING_PROJECT    = 'cashrunway-staging'
    PROD_PROJECT       = 'cashrunway-prod'
    MONITORING_PROJECT = 'cashrunway-monitoring'
    // Homebrew Jenkins on macOS does not inherit a login shell PATH,
    // so Docker Desktop's binary directory is added explicitly.
    PATH = "/Users/komalsingh/.docker/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH}"
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {

    stage('1. Build') {
      steps {
        echo "Building ${APP_NAME}:${IMAGE_TAG}"
        sh 'node --version && npm --version'
        sh 'npm ci'
        sh 'npm run build'
        sh """
          docker build \
            --build-arg APP_VERSION=${IMAGE_TAG} \
            -t ${APP_NAME}:${IMAGE_TAG} \
            -t ${APP_NAME}:latest .
        """
        sh "docker images ${APP_NAME} --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}'"
        sh "docker save ${APP_NAME}:${IMAGE_TAG} | gzip > ${APP_NAME}-${IMAGE_TAG}.tar.gz"
        archiveArtifacts artifacts: "${APP_NAME}-${IMAGE_TAG}.tar.gz", fingerprint: true
      }
    }

    stage('2. Test') {
      steps {
        echo 'Running unit and integration tests'
        sh 'npm test'
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/junit.xml'
          archiveArtifacts artifacts: 'coverage/lcov-report/**', allowEmptyArchive: true
        }
      }
    }

    stage('3. Code Quality') {
      steps {
        echo 'Running static analysis'
        sh 'npx eslint src tests --format stylish | tee eslint-report.txt || true'
        script {
          def sonarUp = sh(script: 'curl -sf http://localhost:9000/api/system/status > /dev/null', returnStatus: true)
          if (sonarUp == 0) {
            sh """
              docker run --rm \
                -e SONAR_HOST_URL=http://host.docker.internal:9000 \
                -e SONAR_TOKEN=\${SONAR_TOKEN} \
                -v "\$(pwd):/usr/src" \
                sonarsource/sonar-scanner-cli
            """
          } else {
            echo 'SonarQube not reachable on localhost:9000 - ESLint results used for this stage.'
          }
        }
        archiveArtifacts artifacts: 'eslint-report.txt', allowEmptyArchive: true
      }
    }

    stage('4. Security') {
      steps {
        echo 'Scanning dependencies and the built image for vulnerabilities'
        sh 'npm audit --audit-level=high --json > npm-audit.json || true'
        sh 'npm audit --audit-level=high || true'
        sh """
          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image \
            --severity HIGH,CRITICAL \
            --exit-code 0 \
            --no-progress \
            --scanners vuln \
            ${APP_NAME}:${IMAGE_TAG} | tee trivy-report.txt
        """
        archiveArtifacts artifacts: 'npm-audit.json,trivy-report.txt', allowEmptyArchive: true
      }
    }

    stage('5. Deploy to staging') {
      steps {
        echo 'Deploying to the staging environment'
        sh "IMAGE_TAG=${IMAGE_TAG} docker compose -p ${STAGING_PROJECT} -f docker-compose.staging.yml down --remove-orphans || true"
        sh "IMAGE_TAG=${IMAGE_TAG} docker compose -p ${STAGING_PROJECT} -f docker-compose.staging.yml up -d"
        sh '''
          echo "Waiting for staging to become healthy..."
          for i in $(seq 1 30); do
            if curl -sf http://localhost:3001/health > /dev/null; then
              echo "Staging is up."
              curl -s http://localhost:3001/health; echo ""
              exit 0
            fi
            sleep 3
          done
          echo "Staging did not become healthy in time."
          docker compose -p cashrunway-staging -f docker-compose.staging.yml logs --tail=50
          exit 1
        '''
      }
    }

    stage('6. Release to production') {
      steps {
        echo 'Promoting the verified build to production'
        // Smoke-test staging end to end before promoting it.
        sh '''
          echo "Smoke testing staging..."
          curl -sf "http://localhost:3001/api/forecast?weeks=13" > /dev/null
          curl -sf "http://localhost:3001/api/recommendations" > /dev/null
          curl -sf "http://localhost:3001/api/invoices" > /dev/null
          echo "Staging smoke tests passed."
        '''
        sh "docker tag ${APP_NAME}:${IMAGE_TAG} ${APP_NAME}:${RELEASE_TAG}"
        sh "docker tag ${APP_NAME}:${IMAGE_TAG} ${APP_NAME}:release-${IMAGE_TAG}"
        sh "RELEASE_TAG=${RELEASE_TAG} docker compose -p ${PROD_PROJECT} -f docker-compose.prod.yml down --remove-orphans || true"
        sh "RELEASE_TAG=${RELEASE_TAG} docker compose -p ${PROD_PROJECT} -f docker-compose.prod.yml up -d"
        sh '''
          echo "Verifying production..."
          for i in $(seq 1 30); do
            if curl -sf http://localhost:3002/health > /dev/null; then
              echo "Production is live."
              curl -s http://localhost:3002/health; echo ""
              curl -s "http://localhost:3002/api/forecast?weeks=13" | head -c 200; echo ""
              echo "Both environments running:"
              docker ps --filter "name=cashrunway" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
              exit 0
            fi
            sleep 3
          done
          echo "Production did not come up - rolling back."
          docker compose -p cashrunway-prod -f docker-compose.prod.yml down || true
          exit 1
        '''
      }
    }

    stage('7. Monitoring and Alerting') {
      steps {
        echo 'Starting Prometheus and Grafana, and verifying metrics collection'
        sh "docker compose -p ${MONITORING_PROJECT} -f docker-compose.monitoring.yml up -d"
        sh '''
          echo "Waiting for Prometheus to be ready..."
          for i in $(seq 1 30); do
            if curl -sf http://localhost:9090/-/ready > /dev/null; then break; fi
            sleep 2
          done

          echo "Generating traffic so there are metrics to collect..."
          for i in $(seq 1 10); do
            curl -s http://localhost:3002/api/forecast > /dev/null
            curl -s http://localhost:3002/api/recommendations > /dev/null
            curl -s http://localhost:3001/api/forecast > /dev/null
          done

          echo "Waiting for Prometheus to scrape both environments..."
          for i in $(seq 1 20); do
            UP_COUNT=$(curl -s "http://localhost:9090/api/v1/query?query=up{job=~\\"cashrunway-.*\\"}" | grep -o '"value"' | wc -l | tr -d ' ')
            if [ "$UP_COUNT" -ge 1 ]; then
              echo "Prometheus is scraping $UP_COUNT CashRunway target(s)."
              break
            fi
            sleep 3
          done

          echo "--- Scrape target health ---"
          curl -s http://localhost:9090/api/v1/targets?state=active \
            | tr ',' '\\n' | grep -E '"job"|"health"|"environment"' | head -20

          echo ""
          echo "--- Alert rules loaded ---"
          curl -s http://localhost:9090/api/v1/rules | tr ',' '\\n' | grep -E '"name"|"state"' | head -12

          echo ""
          echo "--- Request rate recorded by Prometheus ---"
          curl -s "http://localhost:9090/api/v1/query?query=sum(cashrunway_http_requests_total)" | head -c 400
          echo ""

          echo "--- Application metrics sample (production) ---"
          curl -s http://localhost:3002/metrics | grep cashrunway_ | head -8
        '''
      }
    }
  }

  post {
    success {
      echo "Pipeline complete."
      echo "Staging:     http://localhost:3001"
      echo "Production:  http://localhost:3002"
      echo "Prometheus:  http://localhost:9090"
      echo "Grafana:     http://localhost:3003  (anonymous viewer access enabled)"
    }
    failure {
      echo 'Pipeline failed - see the stage logs above.'
    }
    always {
      sh 'docker image prune -f || true'
    }
  }
}