# ── JMeter Runner — TestSage performance testing service ──
FROM eclipse-temurin:17-jre-jammy

ARG JMETER_VERSION=5.6.3
ENV JMETER_HOME=/opt/apache-jmeter-${JMETER_VERSION}
ENV PATH=$JMETER_HOME/bin:$PATH

# Install JMeter + Node (for the lightweight HTTP wrapper)
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      nodejs \
      npm \
    && curl -fsSL "https://dlcdn.apache.org//jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz" -o /tmp/jmeter.tgz \
    && tar -xzf /tmp/jmeter.tgz -C /opt \
    && rm /tmp/jmeter.tgz \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./

RUN mkdir -p /work

EXPOSE 4000

CMD ["node", "server.js"]
