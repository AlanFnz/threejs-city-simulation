import { BUILDING_TYPE } from "../../city/building/constants";
import { SelectTool } from "./selectTool";
import { BulldozeTool } from "./bulldozeTool";
import { BuildingTool } from "./buildingTool";
import { Tool } from "./tool";

export { Tool, GameContext, ToolPreview } from "./tool";
export { SelectTool } from "./selectTool";
export { BulldozeTool } from "./bulldozeTool";
export { BuildingTool } from "./buildingTool";

export function createTools(): Record<string, Tool> {
  const tools = [
    new SelectTool(),
    new BulldozeTool(),
    new BuildingTool(BUILDING_TYPE.RESIDENTIAL),
    new BuildingTool(BUILDING_TYPE.COMMERCIAL),
    new BuildingTool(BUILDING_TYPE.INDUSTRIAL),
    new BuildingTool(BUILDING_TYPE.ROAD),
  ];

  const byId: Record<string, Tool> = {};
  for (const tool of tools) {
    byId[tool.id] = tool;
  }
  return byId;
}
