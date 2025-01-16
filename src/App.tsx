import React, { useEffect, useState } from "react";
import "./App.css";
import { ReactImageEditor } from "./ReactImageEditor";

function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSource, setImageSource] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
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
          <input type="file" onChange={handleFileChange} />
        </div>
        <div className="flex-1">
          {imageSource ? <ReactImageEditor imageSrc={imageSource} /> : null}
        </div>
      </div>
    </div>
  );
}

export default App;
