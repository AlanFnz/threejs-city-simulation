import * as THREE from 'three';
import { VehicleGraphNode } from './vehicleGraphNode';
import { ROAD_TYPE } from '../building/constants';
import { random } from '../../utils/rng';

const roadOffset = 0.05;
const tileOffset = 0.25;

interface VehicleGraphConnection {
  in: VehicleGraphNode | null;
  out: VehicleGraphNode | null;
}

export class VehicleGraphTile extends THREE.Group {
  roadRotation: number;
  left: VehicleGraphConnection;
  right: VehicleGraphConnection;
  top: VehicleGraphConnection;
  bottom: VehicleGraphConnection;

  constructor(x: number, y: number, rotation: number) {
    super();

    this.position.set(x, 0, y);
    this.rotation.set(0, THREE.MathUtils.degToRad(rotation), 0);

    this.roadRotation = rotation;

    this.left = { in: null, out: null };
    this.right = { in: null, out: null };
    this.top = { in: null, out: null };
    this.bottom = { in: null, out: null };
  }

  static create(
    x: number,
    y: number,
    rotation: number,
    style: string
  ): VehicleGraphTile | null {
    switch (style) {
      case ROAD_TYPE.END:
        return new EndRoadTile(x, y, rotation);
      case ROAD_TYPE.STRAIGHT:
        return new StraightRoadTile(x, y, rotation);
      case ROAD_TYPE.CORNER:
        return new CornerRoadTile(x, y, rotation);
      case ROAD_TYPE.THREE_WAY:
        return new ThreeWayRoadTile(x, y, rotation);
      case ROAD_TYPE.FOUR_WAY:
        return new FourWayRoadTile(x, y, rotation);
      default:
        return null;
    }
  }

  disconnectAll(): void {
    for (const node of this.children) {
      if (node instanceof VehicleGraphNode) {
        node.disconnectAll();
        node.removeFromParent();
      }
    }
  }

  getRandomNode(): VehicleGraphNode | null {
    const nodes: VehicleGraphNode[] = [];

    if (this.left.in) nodes.push(this.left.in);
    if (this.right.in) nodes.push(this.right.in);
    if (this.top.in) nodes.push(this.top.in);
    if (this.bottom.in) nodes.push(this.bottom.in);

    if (nodes.length > 0) {
      const i = Math.floor(nodes.length * random());
      return nodes[i];
    } else {
      return null;
    }
  }

  getWorldLeftSide() {
    switch (this.roadRotation) {
      case 0:
        return this.left;
      case 90:
        return this.top;
      case 180:
        return this.right;
      case 270:
        return this.bottom;
      default:
        return this.left;
    }
  }

  getWorldRightSide() {
    switch (this.roadRotation) {
      case 0:
        return this.right;
      case 90:
        return this.bottom;
      case 180:
        return this.left;
      case 270:
        return this.top;
      default:
        return this.right;
    }
  }

  getWorldTopSide() {
    switch (this.roadRotation) {
      case 0:
        return this.top;
      case 90:
        return this.right;
      case 180:
        return this.bottom;
      case 270:
        return this.left;
      default:
        return this.top;
    }
  }

  getWorldBottomSide() {
    switch (this.roadRotation) {
      case 0:
        return this.bottom;
      case 90:
        return this.left;
      case 180:
        return this.top;
      case 270:
        return this.right;
      default:
        return this.bottom;
    }
  }

  protected addNonNull(node: VehicleGraphNode | null): void {
    if (node) {
      this.add(node);
    }
  }
}

export class EndRoadTile extends VehicleGraphTile {
  constructor(x: number, y: number, rotation: number) {
    super(x, y, rotation);

    this.name = `EndRoadTile (${this.position})`;

    this.bottom = {
      in: new VehicleGraphNode(roadOffset, tileOffset),
      out: new VehicleGraphNode(-roadOffset, tileOffset),
    };

    const midpoint = {
      in: new VehicleGraphNode(roadOffset, 0),
      out: new VehicleGraphNode(-roadOffset, 0),
    };

    this.addNonNull(this.bottom.in);
    this.addNonNull(this.bottom.out);
    this.addNonNull(midpoint.in);
    this.addNonNull(midpoint.out);

    this.bottom.in?.connect(midpoint.in);
    midpoint.in?.connect(midpoint.out);
    midpoint.out?.connect(this.bottom.out);
  }
}

export class StraightRoadTile extends VehicleGraphTile {
  constructor(x: number, y: number, rotation: number) {
    super(x, y, rotation);

    this.name = `StraightRoadTile (${this.position})`;

    this.top = {
      in: new VehicleGraphNode(-roadOffset, -tileOffset),
      out: new VehicleGraphNode(roadOffset, -tileOffset),
    };

    this.bottom = {
      in: new VehicleGraphNode(roadOffset, tileOffset),
      out: new VehicleGraphNode(-roadOffset, tileOffset),
    };

    // add to tile
    this.addNonNull(this.top.in);
    this.addNonNull(this.top.out);
    this.addNonNull(this.bottom.in);
    this.addNonNull(this.bottom.out);

    // connect together
    // path #1: bottom -> top
    this.bottom.in?.connect(this.top.out);
    // path #2: top -> bottom
    this.top.in?.connect(this.bottom.out);
  }
}

export class CornerRoadTile extends VehicleGraphTile {
  constructor(x: number, y: number, rotation: number) {
    super(x, y, rotation);

    this.name = `CornerRoadTile (${this.position})`;

    this.bottom = {
      in: new VehicleGraphNode(roadOffset, tileOffset + 0.1),
      out: new VehicleGraphNode(-roadOffset, tileOffset + 0.1),
    };

    this.right = {
      in: new VehicleGraphNode(tileOffset + 0.1, -roadOffset),
      out: new VehicleGraphNode(tileOffset + 0.1, roadOffset),
    };

    const midpointBottomRight = new VehicleGraphNode(
      tileOffset - 1.5 * roadOffset,
      tileOffset - 1.5 * roadOffset
    );

    const midpointTopLeft = new VehicleGraphNode(
      tileOffset - 3 * roadOffset,
      tileOffset - 3 * roadOffset
    );

    this.addNonNull(midpointBottomRight);
    this.addNonNull(midpointTopLeft);
    this.addNonNull(this.right.in);
    this.addNonNull(this.right.out);
    this.addNonNull(this.bottom.in);
    this.addNonNull(this.bottom.out);

    // connect together
    // path #1: bottom -> right
    this.bottom.in?.connect(midpointBottomRight);
    midpointBottomRight.connect(this.right.out);
    // path #2: right -> bottom
    this.right.in?.connect(midpointTopLeft);
    midpointTopLeft.connect(this.bottom.out);
  }
}

export class ThreeWayRoadTile extends VehicleGraphTile {
  constructor(x: number, y: number, rotation: number) {
    super(x, y, rotation);

    this.name = `TeeRoadTile (${this.position})`;

    // create nodes
    this.left = {
      in: new VehicleGraphNode(-tileOffset, roadOffset),
      out: new VehicleGraphNode(-tileOffset, -roadOffset),
    };

    this.right = {
      in: new VehicleGraphNode(tileOffset, -roadOffset),
      out: new VehicleGraphNode(tileOffset, roadOffset),
    };

    this.bottom = {
      in: new VehicleGraphNode(roadOffset, tileOffset),
      out: new VehicleGraphNode(-roadOffset, tileOffset),
    };

    const midpointBottomLeft = new VehicleGraphNode(-roadOffset, roadOffset);
    const midpointBottomRight = new VehicleGraphNode(roadOffset, roadOffset);
    const midpointTopLeft = new VehicleGraphNode(-roadOffset, -roadOffset);
    const midpointTopRight = new VehicleGraphNode(roadOffset, -roadOffset);

    // add to tile
    this.addNonNull(this.left.in);
    this.addNonNull(this.left.out);
    this.addNonNull(this.right.in);
    this.addNonNull(this.right.out);
    this.addNonNull(this.bottom.in);
    this.addNonNull(this.bottom.out);
    this.addNonNull(midpointBottomLeft);
    this.addNonNull(midpointBottomRight);
    this.addNonNull(midpointTopLeft);
    this.addNonNull(midpointTopRight);

    // connect midpoints
    midpointBottomLeft.connect(midpointBottomRight);
    midpointBottomRight.connect(midpointTopRight);
    midpointTopRight.connect(midpointTopLeft);
    midpointTopLeft.connect(midpointBottomLeft);

    // connect inputs to midpoints
    this.left.in?.connect(midpointBottomLeft);
    this.right.in?.connect(midpointTopRight);
    this.bottom.in?.connect(midpointBottomRight);

    // connect midpoints to outputs
    midpointBottomLeft.connect(this.bottom.out);
    midpointBottomRight.connect(this.right.out);
    midpointTopLeft.connect(this.left.out);
  }
}

export class FourWayRoadTile extends VehicleGraphTile {
  constructor(x: number, y: number, rotation: number) {
    super(x, y, rotation);

    this.name = `IntersectionRoadTile (${this.position})`;

    // create nodes
    this.left = {
      in: new VehicleGraphNode(-tileOffset, roadOffset),
      out: new VehicleGraphNode(-tileOffset, -roadOffset),
    };

    this.right = {
      in: new VehicleGraphNode(tileOffset, -roadOffset),
      out: new VehicleGraphNode(tileOffset, roadOffset),
    };

    this.bottom = {
      in: new VehicleGraphNode(roadOffset, tileOffset),
      out: new VehicleGraphNode(-roadOffset, tileOffset),
    };

    this.top = {
      in: new VehicleGraphNode(-roadOffset, -tileOffset),
      out: new VehicleGraphNode(roadOffset, -tileOffset),
    };

    const midpointBottomLeft = new VehicleGraphNode(-roadOffset, roadOffset);
    const midpointBottomRight = new VehicleGraphNode(roadOffset, roadOffset);
    const midpointTopLeft = new VehicleGraphNode(-roadOffset, -roadOffset);
    const midpointTopRight = new VehicleGraphNode(roadOffset, -roadOffset);

    // add to tile
    this.addNonNull(this.left.in);
    this.addNonNull(this.left.out);
    this.addNonNull(this.right.in);
    this.addNonNull(this.right.out);
    this.addNonNull(this.bottom.in);
    this.addNonNull(this.bottom.out);
    this.addNonNull(this.top.in);
    this.addNonNull(this.top.out);
    this.addNonNull(midpointBottomLeft);
    this.addNonNull(midpointBottomRight);
    this.addNonNull(midpointTopLeft);
    this.addNonNull(midpointTopRight);

    // connect midpoints
    midpointBottomLeft.connect(midpointBottomRight);
    midpointBottomRight.connect(midpointTopRight);
    midpointTopRight.connect(midpointTopLeft);
    midpointTopLeft.connect(midpointBottomLeft);

    // connect inputs to midpoints
    this.left.in?.connect(midpointBottomLeft);
    this.right.in?.connect(midpointTopRight);
    this.bottom.in?.connect(midpointBottomRight);
    this.top.in?.connect(midpointTopLeft);

    // connect midpoints to outputs
    midpointBottomLeft.connect(this.bottom.out);
    midpointBottomRight.connect(this.right.out);
    midpointTopRight.connect(this.top.out);
    midpointTopLeft.connect(this.left.out);
  }
}
