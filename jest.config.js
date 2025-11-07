module.exports = {
    "roots": [
        "src"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": ["ts-jest", { "tsconfig": "tsconfig.test.json" }]
    },
    "testEnvironment": "jsdom",
    "moduleNameMapper": {
        "\\.(css|less)$": "identity-obj-proxy"
    }
}; 
