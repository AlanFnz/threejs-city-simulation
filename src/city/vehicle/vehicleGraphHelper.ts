import * as THREE from 'three';
import { VehicleGraph } from './vehicleGraph';
import { VehicleGraphNode } from './vehicleGraphNode';

const UP = new THREE.Vector3(0, 1, 0);

const NODE_GEOMETRY = new THREE.SphereGeometry(0.03, 6, 6);
const EDGE_GEOMETRY = new THREE.ConeGeometry(0.02, 1, 6);

const EDGE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x5050ff });
const CONNECTED_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const DISCONNECTED_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xff0000 });

export class VehicleGraphHelper extends THREE.Group {
  constructor() {
    super();
    this.visible = false;
  }

  // update the visualization of the vehicle graph
  update(graph: VehicleGraph) {
    this.clear(); // clear existing visualizations

    for (let x = 0; x < graph.size; x++) {
      for (let y = 0; y < graph.size; y++) {
        const tile = graph.getTile(x, y);

        if (!tile) continue;

        // create visualizations for each node in the tile
        for (const node of tile.children) {
          if (node instanceof VehicleGraphNode) {
            this.createNodeVisualization(node);
          }
        }
      }
    }
  }

  // create a visualization for a node
  createNodeVisualization(node: VehicleGraphNode) {
    const nodeMesh = new THREE.Mesh(
      NODE_GEOMETRY,
      node.next.length > 0 ? CONNECTED_MATERIAL : DISCONNECTED_MATERIAL
    );

    const nodeWorldPosition = new THREE.Vector3();
    node.getWorldPosition(nodeWorldPosition);

    nodeMesh.position.set(
      nodeWorldPosition.x,
      nodeWorldPosition.y,
      nodeWorldPosition.z
    );

    // add edge visualizations for the connected nodes
    if (node.next.length > 0) {
      for (const next of node.next) {
        // get world position of the next node
        const nextWorldPosition = new THREE.Vector3();
        next.getWorldPosition(nextWorldPosition);

        const edgeVector = new THREE.Vector3();
        edgeVector.copy(nextWorldPosition);
        edgeVector.sub(nodeWorldPosition);

        const distance = edgeVector.length();

        const edgeMesh = new THREE.Mesh(EDGE_GEOMETRY, EDGE_MATERIAL);

        edgeMesh.scale.set(1, distance, 1);

        edgeMesh.quaternion.setFromUnitVectors(
          UP,
          edgeVector.clone().normalize()
        );

        const offset = new THREE.Vector3(0, distance / 2, 0).applyQuaternion(
          edgeMesh.quaternion.clone()
        );

        edgeMesh.position.set(
          nodeWorldPosition.x + offset.x,
          nodeWorldPosition.y + offset.y,
          nodeWorldPosition.z + offset.z
        );

        this.add(edgeMesh);
      }
    }

    this.add(nodeMesh);
  }
}
