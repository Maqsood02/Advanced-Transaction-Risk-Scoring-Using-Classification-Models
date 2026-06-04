import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

# Retrieve from environment variable or put default here
uri = os.environ.get("MONGO_URI", "mongodb+srv://maqsoodmdacin_db_user:YOUR_PASSWORD@cluster0.h5hxo8y.mongodb.net/?appName=Cluster0")

if "YOUR_PASSWORD" in uri:
    print("Please replace YOUR_PASSWORD with your actual database user password.")

print(f"Attempting to connect to: {uri.split('@')[-1]} (password hidden for security)")

# Create a new client and connect to the server
try:
    client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
    # Send a ping to confirm a successful connection
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
