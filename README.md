**Before starting, you need to install the packages with the command
yarn install**

To make changes and develop the project, you need to run the project using the command

`yarn develop`

**After a successful launch, the console displays the addresses by which you can access the rest api and the admin panel**

------------


 **Also, The Following .Env Variables Are Required For Correct Operation.**

------------


1. The postgres database on which all information is stored
```json
DATABASE_URL = 'postgres://ffmmyutwgusxgd: 010effe587b023a087486826297700ddcbf0ac0c4ab99a06bd2f05c2e2115288@ec2-52-1-20-236.compute-1.amazonimawsh3v'
```


> This Line Is Parsed Into Config/Database Using

```javascript
const parse = require ("pg-connection-string").parse;
const config = parse (process.env.DATABASE_URL);
```

**We get**
```json
host: config.host,
port: config.port,
database: config.database,
username: config.user,
password: config.password,
```

2. The wallet from which the pool will be deployed. For correct deployment, you need to be added to the admin of the contract admin
```json
PRIVATE_KEY =
ADDRESS_FROM =
```

3. For the strapi components to work correctly, you must specify the address on which it works
```json
STRAPI_WORK_URL_FOR_QUERY_WEB3 =
```
###### Locally This Is Http: // Localhost: 1337

------------
##### We get this `.env`
------------

```json
DATABASE_URL =
PRIVATE_KEY =
ADDRESS_FROM =
STRAPI_WORK_URL_FOR_QUERY_WEB3 =
```
