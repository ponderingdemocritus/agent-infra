type Tile = {
  biome: number;
  col: number;
  row: number;
  occupier_id: number;
  occupier_type: number;
};

export type Position = { x: number; y: number };
interface PositionWithDirection extends Position {
  direction?: Direction; // Direction taken to reach this position from the previous one
}

interface Node {
  col: number;
  row: number;
  f: number;
  g: number;
  parent?: Node;
  direction: Direction | undefined; // Direction from parent to this node
}

function reconstructPath(endNode: Node): PositionWithDirection[] {
  const path: PositionWithDirection[] = [];
  let current: Node | undefined = endNode;

  while (current) {
    path.unshift({
      x: current.col,
      y: current.row,
      direction: current.direction,
    });
    current = current.parent;
  }

  return path;
}

export function getHexDistance(a: Position, b: Position): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy);
}

export enum Direction {
  EAST,
  NORTH_EAST,
  NORTH_WEST,
  WEST,
  SOUTH_WEST,
  SOUTH_EAST,
}

// if row is even
export const NEIGHBOR_OFFSETS_EVEN = [
  { i: 1, j: 0, direction: Direction.EAST },
  { i: 1, j: 1, direction: Direction.NORTH_EAST },
  { i: 0, j: 1, direction: Direction.NORTH_WEST },
  { i: -1, j: 0, direction: Direction.WEST },
  { i: 0, j: -1, direction: Direction.SOUTH_WEST },
  { i: 1, j: -1, direction: Direction.SOUTH_EAST },
];

// if row is odd
export const NEIGHBOR_OFFSETS_ODD = [
  { i: 1, j: 0, direction: Direction.EAST },
  { i: 0, j: 1, direction: Direction.NORTH_EAST },
  { i: -1, j: 1, direction: Direction.NORTH_WEST },
  { i: -1, j: 0, direction: Direction.WEST },
  { i: -1, j: -1, direction: Direction.SOUTH_WEST },
  { i: 0, j: -1, direction: Direction.SOUTH_EAST },
];

export const getNeighborOffsets = (row: number) => {
  return row % 2 === 0 ? NEIGHBOR_OFFSETS_EVEN : NEIGHBOR_OFFSETS_ODD;
};

export function findDirectionToNeighbor(
  currentRow: number,
  currentHexCoordinates: Position,
  knownNeighborCoordinates: Position
) {
  const offsets = getNeighborOffsets(currentRow); // Your existing function

  for (const offset of offsets) {
    const potentialNeighbor_i = currentHexCoordinates.x + offset.i;
    const potentialNeighbor_j = currentHexCoordinates.y + offset.j;

    if (
      potentialNeighbor_i === knownNeighborCoordinates.x &&
      potentialNeighbor_j === knownNeighborCoordinates.y
    ) {
      return offset.direction; // This is the direction to your known neighbor
    }
  }
  return null; // Neighbor not found with these offsets, or not an immediate neighbor
}

export function findShortestPath(
  oldPosition: Position,
  newPosition: Position,
  exploredTiles: Map<string, Tile>,
  // structureHexes: Map<number, Map<number, HexEntityInfo>>,
  // armyHexes: Map<number, Map<number, HexEntityInfo>>,
  maxDistance: number
): PositionWithDirection[] {
  const oldPos = oldPosition;
  const newPos = newPosition;
  const initialDistance = getHexDistance(oldPos, newPos);
  if (initialDistance > maxDistance) {
    return [];
  }

  const openSet: Node[] = [];
  const closedSet = new Set<string>();
  const startNode: Node = {
    col: oldPos.x,
    row: oldPos.y,
    f: initialDistance, // Heuristic for the start node
    g: 0,
    direction: undefined, // Start node has no incoming direction
  };

  openSet.push(startNode);

  while (openSet.length > 0) {
    const current = openSet.reduce(
      (min, node) => (node.f < min.f ? node : min),
      openSet[0]
    );

    if (current.col === newPos.x && current.row === newPos.y) {
      return reconstructPath(current);
    }

    openSet.splice(openSet.indexOf(current), 1);
    closedSet.add(`${current.col},${current.row}`);

    const neighborOffsets = getNeighborOffsets(current.row);
    for (const offset of neighborOffsets) {
      const neighborCol = current.col + offset.i;
      const neighborRow = current.row + offset.j;

      if (current.g + 1 > maxDistance) {
        continue;
      }

      const tile = exploredTiles.get(`${neighborCol},${neighborRow}`);
      if (!tile || closedSet.has(`${neighborCol},${neighborRow}`)) {
        continue;
      }

      if (neighborCol === newPos.x && neighborRow === newPos.y) {
        return reconstructPath(current);
      }

      if (tile.occupier_id! > 0) continue;
      // if (structureHexes.get(neighborCol)?.has(neighborRow)) continue;
      // if (armyHexes.get(neighborCol)?.has(neighborRow) && !(neighborCol === newPos.x && neighborRow === newPos.y)) continue;

      const g = current.g + 1;
      const h = getHexDistance({ x: neighborCol, y: neighborRow }, newPos);
      const f = g + h;

      const existingNode = openSet.find(
        (n) => n.col === neighborCol && n.row === neighborRow
      );

      if (!existingNode) {
        const neighborNode: Node = {
          col: neighborCol,
          row: neighborRow,
          f,
          g,
          parent: current,
          direction: offset.direction, // Store the direction taken to reach this neighbor
        };
        openSet.push(neighborNode);
      } else if (g < existingNode.g) {
        existingNode.g = g;
        existingNode.f = f;
        existingNode.parent = current;
        existingNode.direction = offset.direction; // Update direction if a better path is found
      }
    }
  }

  return []; // No path found
}
