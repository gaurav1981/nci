'use strict';

var	Steppy = require('twostep').Steppy,
	_ = require('underscore'),
	Node = require('./node').Node;


function Distributor(params) {
	var self = this;
	// nodes to execute builds
	self.nodes = _(params.nodes).map(function(nodeParams) {
		return self._createNode(nodeParams);
	});
	// queued projects to build
	self.queue = [];
}

exports.Distributor = Distributor;

Distributor.prototype._createNode = function(nodeParams) {
	return new Node(nodeParams);
};

Distributor.prototype._runNext = function(callback) {
	var self = this;

	Steppy(
		function() {
			var node;
			var queueItemIndex = _(self.queue).findIndex(function(item) {
				node = _(self.nodes).find(function(node) {
					return node.hasFreeExecutor(item.project);
				});
				return node;
			});

			// quit if we have no suitable project
			if (queueItemIndex) {
				return callback();
			}

			this.pass(node);

			var queueItem = self.queue[queueItemIndex];
			this.pass(queueItemIndex, queueItem);

			queueItem.build.status = 'in-progress';
			self._updateBuild(queueItem.build, this.slot());
		},
		function(err, node, queueItemIndex, queueItem, build) {
			self.queue.splice(queueItemIndex, 1);

			var stepCallback = this.slot();
			node.run(queueItem.project, build.params, function(err) {
				build.status = err ? 'error' : 'done';
				self._updateBuild(build, stepCallback);
			});
		},
		callback
	);
};

Distributor.prototype._updateBuild = function(build, callback) {
	callback(null, build);
};

Distributor.prototype.run = function(project, params, callback) {
	var self = this;
	Steppy(
		function() {
			self._updateBuild({
				project: project,
				params: params,
				status: 'waiting'
			}, this.slot());
		},
		function(err, build) {
			self.queue.push({project: project, build: build});
			self._runNext(this.slot());
		},
		callback
	);
};