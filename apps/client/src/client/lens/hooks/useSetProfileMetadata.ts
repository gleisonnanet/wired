import {
  LensPeriphery__factory,
  ProfileMetadata,
  useCreateSetProfileMetadataTypedDataMutation,
} from "@wired-labs/lens";
import { utils } from "ethers";
import { useSigner, useSignTypedData } from "wagmi";

import { uploadStringToIpfs } from "../../ipfs/uploadStringToIpfs";
import { ContractAddress } from "../constants";
import { pollUntilIndexed } from "../utils/pollUntilIndexed";
import { removeTypename } from "../utils/removeTypename";
import { useLens } from "./useLens";

export function useSetProfileMetadata(profileId: string) {
  const [, createTypedData] = useCreateSetProfileMetadataTypedDataMutation();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: signer } = useSigner();
  const { client } = useLens();

  async function setProfileMetadata(metadata: ProfileMetadata) {
    if (!signer) throw new Error("No signer");

    try {
      // Upload metdata to ipfs
      const url = await uploadStringToIpfs(JSON.stringify(metadata));

      // Create typed data
      const { data, error } = await createTypedData({
        request: {
          profileId,
          metadata: url,
        },
      });

      if (error) throw new Error(error.message);
      if (!data) throw new Error("No typed data returned");

      const typedData = data.createSetProfileMetadataTypedData.typedData;

      // Sign typed data
      const domain = removeTypename(typedData.domain);
      const types = removeTypename(typedData.types);
      const value = removeTypename(typedData.value);

      const signature = await signTypedDataAsync({
        domain,
        types,
        value,
      });

      const { v, r, s } = utils.splitSignature(signature);

      // Send transaction
      const contract = LensPeriphery__factory.connect(
        ContractAddress.LensPeriphery,
        signer
      );
      const tx = await contract.setProfileMetadataURIWithSig({
        profileId: typedData.value.profileId,
        metadata: typedData.value.metadata,
        sig: {
          v,
          r,
          s,
          deadline: typedData.value.deadline,
        },
      });

      // Wait for transaction
      await tx.wait();

      // Wait for indexing
      await pollUntilIndexed(tx.hash, client);
    } catch (error) {
      console.error(error);
    }
  }

  return setProfileMetadata;
}
