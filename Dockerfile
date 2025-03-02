FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your application listens on (if necessary)
EXPOSE 25565

# Command to run the application
CMD ["node", "your_code.js"]