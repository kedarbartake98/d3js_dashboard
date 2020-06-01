from flask import Flask, render_template, url_for, jsonify, request
import pandas as pd
import os
import random, json

app = Flask(__name__)

@app.route('/')
def entrypoint():
	# data = pd.read_csv('static\\data\\train.csv')
	return render_template('index.html')

if __name__=='__main__':
	app.run(debug=True)