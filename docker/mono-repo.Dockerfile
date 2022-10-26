FROM debian:10  
WORKDIR  /app
ADD ./apps/host  /app
RUN apt -y update 
ENV NODE_VERSION=16.14.0
RUN apt install -y curl
RUN \
	set -x \
	&& apt-get update \
	&& apt-get install -y net-tools build-essential python3 python3-pip valgrind   git

RUN curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash 
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
 
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"
RUN echo "NODE Version:" && node --version
RUN echo "NPM Version:" && npm --version 
RUN npm install -g yarn 

EXPOSE 3000

 