import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCreatePostTypedDataMutation } from "@wired-labs/lens";
import { LensHub__factory } from "@wired-labs/lens/contracts";
import { utils } from "ethers";
import { useSigner, useSignTypedData } from "wagmi";

import { ContractAddress } from "../constants";
import { pollUntilIndexed } from "../utils/pollUntilIndexed";
import { removeTypename } from "../utils/removeTypename";
import { useLens } from "./useLens";

export function useCreatePost(profileId: string) {
  const [, createTypedData] = useCreatePostTypedDataMutation();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: signer } = useSigner();
  const { client } = useLens();
  const { openConnectModal } = useConnectModal();

  async function createPost(contentURI: string): Promise<boolean> {
    if (!signer) {
      if (openConnectModal) openConnectModal();
      else throw new Error("No signer");
      return false;
    }

    // Get typed data
    const { data, error } = await createTypedData({
      request: {
        profileId,
        contentURI,
        collectModule: {
          freeCollectModule: {
            followerOnly: false,
          },
        },
        referenceModule: {
          followerOnlyReferenceModule: false,
        },
      },
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error("No data returned from set image");

    const typedData = data.createPostTypedData.typedData;

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
    const contract = LensHub__factory.connect(ContractAddress.LensHub, signer);
    const tx = await contract.postWithSig({
      profileId: typedData.value.profileId,
      contentURI: typedData.value.contentURI,
      collectModule: typedData.value.collectModule,
      collectModuleInitData: typedData.value.collectModuleInitData,
      referenceModule: typedData.value.referenceModule,
      referenceModuleInitData: typedData.value.referenceModuleInitData,
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

    return true;
  }

  return createPost;
}
