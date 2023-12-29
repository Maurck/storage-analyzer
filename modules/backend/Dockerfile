# Build stage
FROM maven:3.8.3-openjdk-17 AS build
COPY pom.xml /app/
COPY src /app/src
RUN mvn -f /app/pom.xml clean package

# Run Stage
FROM openjdk:17 AS run
EXPOSE 5000
COPY --from=build /app/target/*.jar /app/app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]