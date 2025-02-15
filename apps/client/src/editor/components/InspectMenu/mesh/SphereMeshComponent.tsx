import { SphereMesh } from "@wired-labs/engine";

import { updateEntity } from "../../../actions/UpdateEntityAction";
import { useSubscribeValue } from "../../../hooks/useSubscribeValue";
import NumberInput from "../../ui/NumberInput";
import MaterialComponent from "../MaterialComponent";
import MenuRows from "../MenuRows";

interface Props {
  entityId: string;
  mesh: SphereMesh;
}

export default function SphereMeshComponent({ entityId, mesh }: Props) {
  const radius = useSubscribeValue(mesh.radius$);
  const widthSegments = useSubscribeValue(mesh.widthSegments$);
  const heightSegments = useSubscribeValue(mesh.heightSegments$);

  return (
    <>
      <MenuRows titles={["Radius", "Width Segments", "Height Segments"]}>
        {[radius, widthSegments, heightSegments].map((value, i) => {
          const property =
            i === 0 ? "radius" : i === 1 ? "widthSegments" : "heightSegments";
          const name = ["Radius", "Width Segments", "Height Segments"][i];
          const step = name === "Radius" ? 0.1 : 1;

          return (
            <NumberInput
              key={name}
              name={name}
              value={value ?? 0}
              step={step}
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
