import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { ReactImageEditor } from "./ReactImageEditor";
import { Input } from "@/components/ui/input";
import "./App.css";

const tempImageSource =
  "https://fastly.picsum.photos/id/111/1200/800.jpg?hmac=oz1sjdq1Wzml77GI8gkQVi4nKElWzI1edJnvlPXIBrs";
function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSource, setImageSource] = useState<string | null>(
    tempImageSource,
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    // Let's save the user selected file in a state variable
    setImageFile(event.target.files ? event.target.files[0] : null);
  }
  // On change of imageFile we will try to render the image pointed by that file
  useEffect(() => {
    if (imageFile) {
      setImageSource(URL.createObjectURL(imageFile));
    }
  }, [imageFile]);

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-col flex-1">
        <div>
          <Input type="file" onChange={handleFileChange} />
        </div>
        <div className="flex-1">
          {imageSource ? <ReactImageEditor imageSrc={imageSource} /> : null}
        </div>
      </div>
    </div>
  );
}

export default App;
