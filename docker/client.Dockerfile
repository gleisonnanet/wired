FROM debian:10
WORKDIR  /app/apps/client
RUN apt -y update 
ENV NODE_VERSION=16.14.0
RUN apt install -y curl
RUN \
	set -x \
	&& apt-get update \
	&& apt-get install -y net-tools build-essential python3 python3-pip valgrind   git bash 

RUN curl -fsSL https://deb.nodesource.com/setup_16.x |  bash 
RUN \
	set -x \
	&& apt-get update \
	&& apt-get install -y nodejs
 
RUN npm install yarn -g
RUN yarn  install
EXPOSE 3000
CMD [ "yarn", "dev" ]  

 
 
 