# ==============================================================================
# Stage 1: Build Application Artifact
# ==============================================================================
FROM eclipse-temurin:21-jdk-jammy AS builder

WORKDIR /build

# Copy Maven wrapper and project definition first for dependency caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x ./mvnw && ./mvnw dependency:go-offline -B || true

# Copy source code and package application
COPY src/ src/
RUN ./mvnw clean package -DskipTests -B

# ==============================================================================
# Stage 2: Production Container Runtime (Lightweight JRE 21)
# ==============================================================================
FROM eclipse-temurin:21-jre-jammy AS runner

# Create dedicated non-root user and group
RUN groupadd -r appgroup && useradd -r -g appgroup -m -s /bin/false appuser

WORKDIR /app

# Prepare writable temporary upload directory
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

# Copy compiled JAR from builder stage
COPY --from=builder --chown=appuser:appgroup /build/target/placeprep-backend-1.0.0.jar app.jar

USER appuser

# Standard Google Cloud Run default port
ENV PORT=8080
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -Djava.net.preferIPv4Stack=true"

EXPOSE 8080

# Clean entrypoint passing Cloud Run port dynamically
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar app.jar"]
