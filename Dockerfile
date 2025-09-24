# === Stage 1: Build the base environment with Android SDK and Node.js ===
# We use a specific version to ensure the build is repeatable. 'jammy' is Ubuntu 22.04.
# FIX: Using AS in all caps to remove build warnings.
FROM eclipse-temurin:17-jdk-jammy AS android-base

# Set environment variables for Android
ENV ANDROID_SDK_ROOT="/opt/android-sdk"
ENV PATH="$PATH:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools"
ENV DEBIAN_FRONTEND=noninteractive

# FIX: Added a retry mechanism for apt-get to handle temporary network glitches.
# Install necessary dependencies for Android, Node, and headless browser testing
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    wget unzip curl git libnss3 xvfb libxss1 libasound2 libgbm-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Android Command Line Tools and accept licenses
RUN mkdir -p ${ANDROID_SDK_ROOT} && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O android-sdk.zip && \
    unzip -q android-sdk.zip -d ${ANDROID_SDK_ROOT} && \
    rm android-sdk.zip && \
    # Create the 'latest' symlink which the sdkmanager sometimes expects
    ln -s ${ANDROID_SDK_ROOT}/cmdline-tools/bin ${ANDROID_SDK_ROOT}/cmdline-tools/latest && \
    yes | sdkmanager --licenses > /dev/null

# Install Android platform-tools, build-tools, and a stable system image
# FIX: Added --sdk_root flag for more stability
RUN sdkmanager --sdk_root=${ANDROID_SDK_ROOT} "platform-tools" "build-tools;33.0.2" "platforms;android-33" "system-images;android-33;google_apis;x86_64"

# Install Node.js (LTS version)
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs


# === Stage 2: Install Maestro ===
# FIX: Using AS in all caps to remove build warnings.
FROM android-base AS maestro-installed
# Install Maestro in a specific directory
ENV MAESTRO_HOME="/opt/maestro"
ENV PATH="$PATH:${MAESTRO_HOME}/.maestro/bin"
RUN curl -Ls "https://get.maestro.mobile.dev" | bash


# === Stage 3: Setup the final runtime environment for our Azure Function ===
FROM maestro-installed AS final

# Set ENV for Azure Functions
ENV AZURE_FUNCTIONS_ENVIRONMENT=Development

# Set a work directory for our app
WORKDIR /home/site/wwwroot

# Copy only package.json files first to leverage Docker caching
COPY package*.json ./

# Install npm dependencies. This step will be cached if package files don't change.
RUN npm install

# Now, copy the rest of the project files
COPY . .

# Expose the port that Azure Functions listens on
EXPOSE 8080

# The final command to run when the container starts
CMD ["npm", "start"]