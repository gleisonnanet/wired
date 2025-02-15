import { BoxMesh } from "@wired-labs/engine";

import { updateEntity } from "../../../actions/UpdateEntityAction";
import { useSubscribeValue } from "../../../hooks/useSubscribeValue";
import NumberInput from "../../ui/NumberInput";
import MaterialComponent from "../MaterialComponent";
import MenuRows from "../MenuRows";

interface Props {
  entityId: string;
  mesh: BoxMesh;
}

export default function BoxMeshComponent({ entityId, mesh }: Props) {
  const width = useSubscribeValue(mesh.width$);
  const height = useSubscribeValue(mesh.height$);
  const depth = useSubscribeValue(mesh.depth$);

  return (
    <>
      <MenuRows titles={["Width", "Height", "Depth"]}>
        {[width, height, depth].map((value, i) => {
          const property = i === 0 ? "width" : i === 1 ? "height" : "depth";
          const name = ["Width", "Height", "Depth"][i];

          return (
            <NumberInput
              key={name}
              name={name}
              value={value ?? 0}
              step={0.1}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;

                const num = parseFloat(value);
                const rounded = Math.round(num * 1000) / 1000;

                mesh[property] = rounded;

                updateEntity(entityId, { mesh: mesh.toJSON() });
              }}
            />
          );
        })}
      </MenuRows>

      <MaterialComponent entityId={entityId} />
    </>
  );
}
