import { Material, Mesh, MeshStandardMaterial, Object3D } from "three";

export function disposeObject(root: Object3D) {
  root.removeFromParent();

  root.traverse((object) => {
    if (object instanceof Mesh) {
      const mesh = object as Mesh;

      const materials =
        mesh.material instanceof Array ? mesh.material : [mesh.material];

      materials.forEach(disposeMaterial);

      // Dispose geometry
      mesh.geometry.dispose();
    }
  });
}

export function disposeMaterial(material: Material) {
  // Dispose textures
  if (material instanceof MeshStandardMaterial) {
    if (material.map) material.map.dispose();
    if (material.normalMap) material.normalMap.dispose();
    if (material.roughnessMap) material.roughnessMap.dispose();
    if (material.metalnessMap) material.metalnessMap.dispose();
    if (material.aoMap) material.aoMap.dispose();
    if (material.emissiveMap) material.emissiveMap.dispose();
    if (material.envMap) material.envMap.dispose();
  }

  // Dispose material
  material.dispose();
}
