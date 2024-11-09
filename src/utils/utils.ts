function isValidEmail(value: string): boolean { // {{ edit_1 }}
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(value).toLowerCase());
}

function validateEmail(value: string, setEmailError: (error: string) => void): void { // {{ edit_2 }}
    if (value == "") {
        setEmailError("")
    }
    else if (isValidEmail(value)) {
        setEmailError("")
    }
    else {
        setEmailError("Invalid Email")
    }
}

function validatePassword(value: string, setPasswordError: (error: string) => void): void { // {{ edit_3 }}
    if (value.length < 8) {
        setPasswordError("Password must be 8 characters")
    } 
    // check if password contains at least one uppercase letter, one lowercase letter, and one number
    else if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
        setPasswordError("Password must contain at least one uppercase letter, one lowercase letter, and one number")
    } else {
        setPasswordError("")
    }
}

function validateInput(value: string, minLength: number, setError: (error: string) => void): void { // {{ edit_4 }}
    if (value.length < minLength) {
        setError("Invalid Input")
    } else {
        setError("")
    }
}

const utils = {
    isValidEmail,
    validateEmail,
    validatePassword,                                           
    validateInput,
    // calculateAngle
};

export default utils;