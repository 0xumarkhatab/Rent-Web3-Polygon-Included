import {
  Box,
  HStack,
  VStack,
  Input,
  Img,
  Button,
  Center,
  RadioGroup,
  Stack,
  Radio,
  Heading,
  Text,
} from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import NamedInput from "./components/NamedInput";
import LinkButton from "./components/LinkButton/LinkButton";
import { Web3Storage } from "web3.storage";
import { getCustomNetworkWebsiteRentContract } from "./data/WebsiteRent";
import { getAllDappsUris } from "./data/ipfsStuff";
import { parseEther } from "ethers/lib/utils";
import { useRouter } from "next/router";
import { getProviderOrSigner } from "./data/accountsConnection";

export async function getStaticProps(context) {
  require("dotenv").config();
  return {
    props: { token: process.env.WEB3STORAGE_TOKEN }, // will be passed to the page component as props
  };
}
let NetworkChain = "goerli";
function CreateDapp(props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");
  const [price, setPrice] = useState("");
  const [owner, setOwner] = useState('');
  const [blockchain, setBlockchain] = useState("ethereum");
  const [dappImage, setDappImage] = useState(null);
  const [allDapps, setAllDapps] = useState([]);
  const [loader, setLoader] = useState(false);
  const [type, setType] = useState("sale");
  const router = useRouter();
  const Web3ModalRef = useRef();
  const [websiteRentContract, setWebsiteRentContract] = useState(null);

  function getAccessToken() {
    return props.token;
  }
  function makeStorageClient() {
    return new Web3Storage({ token: getAccessToken() });
  }
  function getDappImage() {
    const fileInput = document.querySelector('input[type="file"]');
    return fileInput.files;
  }
  async function makeDappFile() {
    let imageCid = await storeDappImage();

    const obj = {
      name,
      url,
      price,
      owner,
      blockchain,
      image: imageCid,
      type,
      id: allDapps.length + 1,
    };
    const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });

    const files = [new File([blob], `metadata.json`)];

    return files;
  }
  async function storeDappImage() {
    const client = makeStorageClient();
    const _file = new File(getDappImage(), 'img.PNG')
    const cid = await client.put([_file]);
    console.log("stored image on :", cid);
    return cid;
  }
  async function StoreUpdatedDappsOnIpfs(dappArray) {
    const _blob = new Blob(
      [
        JSON.stringify({
          dapps: [...dappArray],
        }),
      ],
      { type: "application/json" }
    );
    const updatedDappInfo = [new File([_blob], `dappInfo.json`)];
    let newCID = await storeWithProgress(updatedDappInfo);
    return newCID;
  }
  async function storeWithProgress(files) {
    // show the root cid as soon as it's ready
    const onRootCidReady = (cid) => {
      console.log("uploading files with cid:", cid);
    };

    // when each chunk is stored, update the percentage complete and display
    const totalSize = files.map((f) => f.size).reduce((a, b) => a + b, 0);
    let uploaded = 0;

    const onStoredChunk = (size) => {
      uploaded += size;
      const pct = 100 * (uploaded / totalSize);
    };

    const client = makeStorageClient();
    return client.put(files, { onRootCidReady, onStoredChunk });
  }

  function setStatus(message) {
    let ele = document.getElementById("creationStatus");
    var p_tag = document.createElement("p");
    p_tag.key = `message${message}`;
    p_tag.textContent = '-> ' + message;
    ele.append(p_tag);
  }

  async function create_dapp() {
    if (dappImage == null) {
      alert("Kindly upload an image");
      return 0;
    }
    let WebsiteRentContract = websiteRentContract;
    setLoader(true);
    let ifExists = await WebsiteRentContract.websiteExists(url);
    if (!ifExists) {
      setStatus("Website Approved 🥳 ");
      setStatus("Initiating Dapp Upload");
      setStatus("Creating Dapp..")

    }
    else {
      alert("Website Name Already Exists");
      return 0;
    }

    let _files = await makeDappFile();
    let dappCid = await storeWithProgress(_files);


    let existingDapps = [...allDapps];
    existingDapps.push(dappCid);
    setAllDapps(existingDapps);
    setStatus("Storing on IPFS...");
    // ipfs storing part
    let newCID = await StoreUpdatedDappsOnIpfs(existingDapps);
    setStatus("Success on IPFS Storage 🎉");
    try {
      setStatus("Storing on Smart contract !");
      // smart contract part
      let _price = parseEther(price);
      console.log("Price to pay is ", _price);
      setStatus("Uploading on Smart contract !");

      let tx = await WebsiteRentContract.uploadWebsite(url, parseEther(price), owner);
      setStatus("Transaction Mining.. ",);
      await tx.wait();
      setStatus("Successfully Mined 🎉");
      setStatus("Uploading global IPFS Link ",);
      let priviledgedWebsiteRentContract = PriviledgedWebsiteRentContract;
      tx = await priviledgedWebsiteRentContract.updateWebsitesIPFSLink(newCID);
      setStatus("Transaction Mining.. ",);
      await tx.wait();
      setStatus("Successfully storage 🎉");
      router.push("/Explore");

    } catch (err) {
      if (err.toString().includes("already exist")) {
        alert("website already exists");
        console.log(err)
        return 0;
      }
      else if (err.toString().includes("estimate gas")) {
        alert("You do not have funds!");
        console.log(err);
        return 0;
      } else {
        alert("open console to see error");
        console.log("error :", err);
      }
    }
  }

  async function getUserInfo() {
    getProviderOrSigner(NetworkChain, Web3ModalRef, true).then(signer => {
      signer.getAddress().then(setOwner).catch(console.log);

    });

  }
  async function init() {
    await getUserInfo();
    getCustomNetworkWebsiteRentContract(NetworkChain, Web3ModalRef, setWebsiteRentContract).then(async (contract) => {
      await getAllDappsUris(contract, setAllDapps);
      setWebsiteRentContract(contract);

    }).catch(e => {
      console.log("error  in obtaining the contract ")
    });

  }
  useEffect(() => {
    init();
  }, []);
  return (
    <Center
      bg="black"
      textColor={"white"}
      height={loader?"fit-content":"100vh"}
      width={"100vw"}
      flexDirection={"column"}
      align={"left"}
    >

      <Stack
        width={"80vw"}
        flexDirection={["column", "column", "row"]}
        align="center"
        justify={"space-evenly"}
        spacing={30}
        height={"80vh"}
      >
        <VStack width={"40vw"} spacing={5}>
          <NamedInput title={"Name"}>
            {" "}
            <Input
              key={"dappName"}
              onChange={(e) => {
                let res = e.target.value;
                setName(res);
              }}
              variant="outline"
              placeholder={"Let's have a cool name "}
            />
          </NamedInput>
          <HStack width={["38vw"]} justify={"space-between"}>
            <Heading align={"left"} fontSize={"20px"}>
              Dapp Type
            </Heading>
            <RadioGroup defaultValue="2">
              <HStack spacing={10}>
                <Radio
                  onClick={() => type !== "whitelist" && setType("whitelist")}
                  colorScheme="green"
                  value="1"
                >
                  Whitelist
                </Radio>
                <Radio
                  onClick={() => type !== "sale" && setType("sale")}
                  colorScheme="green"
                  value="2"
                >
                  Sale
                </Radio>
              </HStack>
            </RadioGroup>
          </HStack>

          <NamedInput title={"Deployed Url"}>
            {" "}
            <Input
              key={"deployedURL"}
              onChange={(e) => {
                let res = e.target.value;
                setUrl(res);
              }}
              variant="outline"
              defaultValue={url}
            />
          </NamedInput>

          <NamedInput title={"Price per Day"}>
            {" "}
            <Input
              key={"rentPrice"}
              type={"number"}
              onChange={(e) => {
                let res = e.target.value;
                setPrice(res);
              }}
              variant="outline"
            />
          </NamedInput>
          <NamedInput title={"Blockchain"}>
            {" "}
            <Input
              key={"blockchainType"}
              variant="outline"
              onChange={() => { }}
              value="Currently we only support ETH"
            />
          </NamedInput>

          <NamedInput title={"Owner"}>
            {" "}
            <Input
              key={"dappOwner"}
              onChange={(e) => {
                let res = e.target.value;
                setOwner(res);
              }}
              variant="outline"
              defaultValue={owner}
            />
          </NamedInput>
        </VStack>
        <VStack>
          <Img
            width={"30vw"}
            height={"40vh"}
            borderRadius="10px"
            src={dappImage ? dappImage : "https://i.stack.imgur.com/tDPMH.png"}
          />
          <Input
            id="upload-btn"
            title={"Upload"}
            display={"none"}
            type={"file"}
            onChange={(event) => {
              setDappImage(URL.createObjectURL(event.target.files[0]));
            }}
          />
          <HStack spacing={"10"}>
            <Button
              bg="black"
              textColor={"white"}
              _hover={{
                background: "black",
                color: "white",
              }}
              variant="outline"
              onClick={() => setDappImage(null)}
            >
              Discard
            </Button>
            <Button
              onClick={() => {
                document.getElementById("upload-btn").click();
              }}
              variant="solid"
              colorScheme={"green"}
            >
              Upload
            </Button>
          </HStack>
        </VStack>
      </Stack>
      <Box >
        <LinkButton
          onClick={create_dapp}
          title={`Create Dapp`}
          loadingMessage={"Creating Dapp"}
          key={"creating dapp"}
          color={"green"}
          variant={"solid"}
        />
      </Box>


      <VStack  paddingTop={"5vh"}  height={loader ? "fit-content" : "0.01vh"} width={"100vw"}>
        <Heading > {loader ? "Dapp Upload Started" : ""} </Heading>
        <VStack width={"50vw"} align={"center"} paddingTop={"10vh"} id="creationStatus" >

        </VStack>
      </VStack>

    </Center >
  );
}

export default CreateDapp;