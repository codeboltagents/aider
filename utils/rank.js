// const { DirectedGraph } = require('graphology');
// const pagerank = require('graphology-pagerank');

// // Create a directed graph
// const graph = new DirectedGraph();

// // Add nodes
// graph.addNode('A');
// graph.addNode('B');
// graph.addNode('C');
// graph.addNode('D');

// // Add edges
// graph.addEdge('A', 'B');
// graph.addEdge('B', 'C');
// graph.addEdge('C', 'A');
// graph.addEdge('A', 'D');
// graph.addEdge('D', 'A');


// console.log(graph)
// // Compute PageRank
// const ranks = pagerank(graph);

// console.log(ranks);


const { MultiDirectedGraph, DirectedGraph } = require('graphology');
const pagerank = require('graphology-pagerank');

// Create a new MultiDirectedGraph instance
const multiGraph = new MultiDirectedGraph();

// Add nodes
multiGraph.addNode('A');
multiGraph.addNode('B');
multiGraph.addNode('C');

// Add edges with weights (some multi-edges for testing)
multiGraph.addEdge('A', 'B', { weight: 1 });
multiGraph.addEdge('B', 'C', { weight: 1 });
multiGraph.addEdge('C', 'A', { weight: 1 });
multiGraph.addEdge('A', 'C', { weight: 0.5 }); // Multi-edge example

// Convert MultiDirectedGraph to a simple DirectedGraph
const directedGraph = new DirectedGraph();

// Aggregate edge weights into the DirectedGraph
multiGraph.forEachEdge((edge, attributes, source, target) => {
  if (!directedGraph.hasNode(source)) directedGraph.addNode(source);
  if (!directedGraph.hasNode(target)) directedGraph.addNode(target);
  
  // Aggregate weights if the edge already exists
  if (directedGraph.hasEdge(source, target)) {
    const existingWeight = directedGraph.getEdgeAttribute(source, target, 'weight') || 0;
    directedGraph.setEdgeAttribute(source, target, 'weight', existingWeight + attributes.weight);
  } else {
    directedGraph.addEdge(source, target, { weight: attributes.weight });
  }
});

// Compute PageRank
const pagerankValues = pagerank(directedGraph, {
  getEdgeWeight: 'weight',
  personalization: {},
  damping: 0.85,
  maxIterations: 100,
  tolerance: 1e-6
});

// Output PageRank values
console.log('PageRank values:', pagerankValues);

