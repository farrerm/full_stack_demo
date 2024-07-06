import logo from './logo.svg';
import './App.css';
import React, { useState, ChangeEvent, FormEvent } from 'react';

import './App.css';
import './ResponsiveForm.css'; //will creatre later

const ResponsiveForm = () => {
  const [textInput, setTextInput] = useState('');
  const [fileInput, setFileInput] = useState(null);

  const handleTextChange = (e) => {
    console.log('got some text');
    setTextInput(e.target.value);
  };

  const handleFileChange = (e) => {
    console.log('got a file');
    if (e.target.files && e.target.files.length > 0) {
      setFileInput(e.target.files[0]);
    } else {
      setFileInput(null);
    }
  };

  const handleSubmit = (e) => {
    console.log('well at least we pressed a button.')
    e.preventDefault();
    // Handle form submission here
    console.log('Text Input:', textInput);
    console.log('File Input:', fileInput);
  };

  return (
    <form className="responsive-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="textInput">Text Input:</label>
        <input
          type="text"
          id="textInput"
          value={textInput}
          onChange={handleTextChange}
          placeholder="Enter text here"
        />
      </div>
      <div className="form-group">
        <label htmlFor="fileInput">File Input:</label>
        <input
          type="file"
          id="fileInput"
          onChange={handleFileChange}
        />
      </div>
      <button type="submit">Submit</button>
    </form>
  );
};

export default ResponsiveForm;