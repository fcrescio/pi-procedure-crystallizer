FROM pi-sandbox:latest

USER root

ARG JADX_VERSION=1.5.1
ARG APKTOOL_VERSION=2.9.3
ARG RIZIN_VERSION=0.9.1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates curl file unzip p7zip-full binutils xz-utils \
       openjdk-17-jre-headless python3 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /opt/jadx /opt/apktool \
  && curl -fsSL "https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip" -o /tmp/jadx.zip \
  && unzip -q /tmp/jadx.zip -d /opt/jadx \
  && ln -s /opt/jadx/bin/jadx /usr/local/bin/jadx \
  && curl -fsSL "https://github.com/iBotPeaches/Apktool/releases/download/v${APKTOOL_VERSION}/apktool_${APKTOOL_VERSION}.jar" -o /opt/apktool/apktool.jar \
  && printf '#!/bin/sh\nexec java -jar /opt/apktool/apktool.jar "$@"\n' > /usr/local/bin/apktool \
  && chmod +x /usr/local/bin/apktool \
  && curl -fsSL "https://github.com/rizinorg/rizin/releases/download/v${RIZIN_VERSION}/rizin-v${RIZIN_VERSION}-static-x86_64.tar.xz" -o /tmp/rizin.tar.xz \
  && mkdir -p /opt/rizin \
  && tar -xJf /tmp/rizin.tar.xz -C /opt/rizin --strip-components=1 \
  && ln -s /opt/rizin/rizin /usr/local/bin/rizin \
  && ln -s /opt/rizin/rz-bin /usr/local/bin/rz-bin \
  && rm -f /tmp/jadx.zip /tmp/rizin.tar.xz

WORKDIR /workspace
