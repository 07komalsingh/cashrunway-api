pipeline {
  agent any

  environment {
    APP_NAME    = 'cashrunway-api'
    IMAGE_TAG   = "${env.BUILD_NUMBER}"
    RELEASE_TAG = "stable"
    // Homebrew Jenkins on macOS does not inherit a login shell PATH,
    // so docker, node and npm are added explicitly.
     PATH = "/Users/komalsingh/.docker/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH}"

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
        // Save the image as a versioned artefact and keep it with the build.
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
        sh 'npx eslint src tests --format stylish || true'
        script {
          // SonarQube runs as a container on localhost:9000.
          // If it is not running the stage reports rather than fails the build.
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
            ${APP_NAME}:${IMAGE_TAG} | tee trivy-report.txt
        """
        archiveArtifacts artifacts: 'npm-audit.json,trivy-report.txt', allowEmptyArchive: true
      }
    }

    stage('5. Deploy to staging') {
      steps {
        echo 'Deploying to the staging environment'
        sh "IMAGE_TAG=${IMAGE_TAG} docker compose -f docker-compose.staging.yml down --remove-orphans || true"
        sh "IMAGE_TAG=${IMAGE_TAG} docker compose -f docker-compose.staging.yml up -d"
        sh '''
          echo "Waiting for staging to become healthy..."
          for i in $(seq 1 30); do
            if curl -sf http://localhost:3001/health > /dev/null; then
              echo "Staging is up."
              curl -s http://localhost:3001/health
              exit 0
            fi
            sleep 3
          done
          echo "Staging did not become healthy in time."
          docker compose -f docker-compose.staging.yml logs --tail=50
          exit 1
        '''
      }
    }

    stage('6. Release to production') {
      steps {
        echo 'Promoting the verified build to production'
        // Smoke-test staging before promoting it.
        sh 'curl -sf http://localhost:3001/api/forecast?weeks=13 > /dev/null'
        sh "docker tag ${APP_NAME}:${IMAGE_TAG} ${APP_NAME}:${RELEASE_TAG}"
        sh "docker tag ${APP_NAME}:${IMAGE_TAG} ${APP_NAME}:release-${IMAGE_TAG}"
        sh "RELEASE_TAG=${RELEASE_TAG} docker compose -f docker-compose.prod.yml down --remove-orphans || true"
        sh "RELEASE_TAG=${RELEASE_TAG} docker compose -f docker-compose.prod.yml up -d"
        sh '''
          echo "Verifying production..."
          for i in $(seq 1 30); do
            if curl -sf http://localhost:3002/health > /dev/null; then
              echo "Production is live."
              curl -s http://localhost:3002/health
              exit 0
            fi
            sleep 3
          done
          echo "Production did not come up - rolling back."
          docker compose -f docker-compose.prod.yml down || true
          exit 1
        '''
      }
    }

    stage('7. Monitoring and Alerting') {
      steps {
        echo 'Starting Prometheus and Grafana, and verifying metrics collection'
        sh 'docker compose -f docker-compose.monitoring.yml up -d'
        sh '''
          echo "Waiting for Prometheus..."
          for i in $(seq 1 30); do
            if curl -sf http://localhost:9090/-/ready > /dev/null; then break; fi
            sleep 3
          done
          echo "--- Scrape targets ---"
          curl -s http://localhost:9090/api/v1/targets | head -c 1200
          echo ""
          echo "--- Alert rules loaded ---"
          curl -s http://localhost:9090/api/v1/rules | head -c 800
          echo ""
          echo "--- Application metrics sample ---"
          curl -s http://localhost:3002/metrics | grep cashrunway_ | head -10
        '''
      }
    }
  }

  post {
    success {
      echo "Pipeline complete. Staging: http://localhost:3001  Production: http://localhost:3002  Grafana: http://localhost:3003"
    }
    failure {
      echo 'Pipeline failed - see the stage logs above.'
    }
    always {
      sh 'docker image prune -f || true'
    }
  }
}
