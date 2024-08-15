const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const app = express();
const port = 3000;
const url = "mongodb://127.0.0.1:27017";
const client = new MongoClient(url);
const dbName = "dbFriends";
const collectionname = "friends";
const querystring = require("querystring");
const multer = require("multer");
const friends = multer({ dest: "public/images/" });

const bodyParser = require("body-parser");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

app.get("/createFriend", (req, res) => {
    res.sendFile(__dirname + "/public/pages/create.html");
});
app.get("/findFriend", (req, res) => {
    res.sendFile(__dirname + "/public/pages/find.html");
});
app.get("/updateFriend", (req, res) => {
    res.sendFile(__dirname + "/public/pages/FindUpdate.html");
});
app.get("/deleteFriend", (req, res) => {
    res.sendFile(__dirname + "/public/pages/findDelete.html");
});
app.get("/update/friend", (req, res) => {
    const { Id, Name, IDCard, Countryside, Date } = req.query;

    res.sendFile(__dirname + "/public/pages/update.html");
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/images");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});

process.on("SIGINT", () => {
    if (client) {
        client
            .close()
            .then(() => {
                console.log("Disconnected from MongoDB");
                process.exit(0);
            })
            .catch((error) => {
                console.error("Failed to disconnect from MongoDB", error);
                process.exit(1);
            });
    } else {
        process.exit(0);
    }
});

// InSert
async function insert(newFriends) {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");

        const friendsCollection = client.db(dbName).collection(collectionname);
        const highestFriend = await friendsCollection
            .find()
            .sort({ Id: -1 })
            .limit(1)
            .toArray();
        let maxID = 0;
        if (highestFriend.length > 0) {
            maxID = parseInt(highestFriend[0].Id.substring(3));
        }

        const maxIDPlusOne = maxID + 1;
        const newIDs = Array.from(
            { length: newFriends.length },
            (_, index) => "frs0" + String(maxIDPlusOne + index).padStart(3, "0")
        );

        newFriends.forEach((friend, index) => {
            friend.Id = newIDs[index];
        });

        await friendsCollection.insertMany(newFriends);
        console.log("Friends added successfully!", newFriends);
    } catch (err) {
        console.error("Error", err);
        throw err;
    }
}

const upload = multer({ storage: storage });

app.post("/create", upload.array("Image", 10), async (req, res) => {
    try {
        const formData = req.body;
        const images = req.files || [];

        const formDataArray = Array.isArray(formData) ? formData : [formData];

        const newFriends = [];

        for (let index = 0; index < formDataArray.length; index++) {
            const formData = formDataArray[index];

            const newFriend = {
                Name: formData.Name,
                IDCard: parseInt(formData.IDCard),
                Countryside: formData.Countryside,
                Date: parseInt(formData.Date),
            };

            if (images.length > index && images[index].filename) {
                newFriend.Image = images[index].filename;
            }

            newFriends.push(newFriend);
        }

        await insert(newFriends);

        res.json({
            message: `${newFriends.length} Friends created successfully!`,
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Find
app.get("/findFriend/search", async (req, res) => {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");

        const friendsCollection = client.db(dbName).collection(collectionname);

        const Name = req.query.Name;
        const DateFr = req.query.DateFr;
        const DateTo = req.query.DateTo;

        const query = {};

        if (Name && DateFr && DateTo) {
            query.$or = [
                { Name: { $regex: Name, $options: "i" } },
                { Date: { $gte: parseInt(DateFr), $lte: parseInt(DateTo) } },
            ];
        } else if (Name) {
            query.Name = { $regex: Name, $options: "i" };
        } else if (DateFr && DateTo) {
            query.Date = { $gte: parseInt(DateFr), $lte: parseInt(DateTo) };
        } else if (DateFr && !DateTo) {
            query.Date = { $gte: parseInt(DateFr) };
        } else if (!DateFr && DateTo) {
            query.Date = { $lte: parseInt(DateTo) };
        }

        const friends = await friendsCollection
            .find(query)
            .sort({ Id: -1 })
            .toArray();

        if (friends.length === 0) {
            res.json({
                message: `Object not found`,
            });
        } else {
            res.json(friends);
        }
    } catch (err) {
        console.error("Error", err);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/update/search", async (req, res) => {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");

        const friendsCollection = client.db(dbName).collection(collectionname);

        const Name = req.query.Name;
        const Countryside = req.query.Countryside;
        const query = {};

        if (Name) {
            query.Name = { $regex: Name, $options: "i" };
        }
        if (Countryside) {
            query.Countryside = { $regex: Countryside, $options: "i" };
        }

        const friends = await friendsCollection.find(query).toArray();

        if (friends.length === 0) {
            res.json({
                message: `Object not found`,
            });
        } else {
            res.json(friends);
        }
    } catch (err) {
        console.error("Error", err);
        res.status(500).send("Internal Server Error");
    }
});

app.put("/updatting", upload.single("Image"), async (req, res) => {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully.");

        const newFriend = req.body;
        const Id = newFriend.Id;

        const friendsCollection = client.db(dbName).collection(collectionname);

        // Lấy tên file ảnh đã được lưu trữ trên server từ req.file
        const imageName = req.file ? req.file.filename : null;

        await friendsCollection.updateOne(
            { Id: Id },
            {
                $set: {
                    Name: newFriend.Name,
                    IDCard: newFriend.IDCard,
                    Countryside: newFriend.Countryside,
                    Date: newFriend.Date,
                    Image: imageName, // Lưu tên file ảnh vào cơ sở dữ liệu
                },
            }
        );

        const content = `Friend Id = ${newFriend.Id} updated successfully`;
        res.json({ message: content });
    } catch (err) {
        console.error("Error", err);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/delete/search", async (req, res) => {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");

        const friendsCollection = client.db(dbName).collection(collectionname);

        const Name = req.query.Name;
        const query = {};

        if (Name) {
            query.Name = { $regex: Name, $options: "i" };
        }

        const friends = await friendsCollection.find(query).toArray();

        if (friends.length === 0) {
            res.json({
                message: `Object not found`,
            });
        } else {
            res.json(friends);
        }
    } catch (err) {
        console.error("Error", err);
        res.status(500).send("Internal Server Error");
    }
});

// delete
app.delete("/delete/all", async (req, res) => {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");

        const friendsCollection = client.db(dbName).collection(collectionname);

        const Name = req.query.Name; // Lấy tên bạn bè cần xóa từ yêu cầu

        const query = {}; // Tạo một query để tìm kiếm dựa trên tên nếu có

        if (Name) {
            query.Name = { $regex: Name, $options: "i" }; // Sử dụng biểu thức chính quy để tìm kiếm không phân biệt chữ hoa chữ thường
        }

        const result = await friendsCollection.deleteMany(query);

        if (result.deletedCount > 0) {
            res.status(200).send(
                "All friends matching the search criteria deleted successfully"
            );
        } else {
            res.status(404).send(
                "No friends matching the search criteria found to delete"
            );
        }
    } catch (error) {
        console.error("Error deleting friends:", error);
        res.status(500).send("Failed to delete friends");
    }
});

app.delete("/deleted/:friendId", async (req, res) => {
    const friendId = req.params.friendId;

    try {
        const friendsCollection = client.db(dbName).collection(collectionname);
        const result = await friendsCollection.deleteOne({ Id: friendId });

        if (result.deletedCount === 1) {
            res.status(200).send("Friend deleted successfully");
        } else {
            res.status(404).send("Friend not found");
        }
    } catch (error) {
        console.error("Error deleting friend:", error);
        res.status(500).send("Failed to delete friend");
    }
});
// List
app.get("/friendsData", async (req, res) => {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully.");
        const friends = await client
            .db(dbName)
            .collection(collectionname)
            .find()
            .toArray();

        res.json(friends);
    } catch (error) {
        console.error("Failed to fetch documents:", error);
        res.status(500).send("Failed to fetch documents");
    }
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/pages/home.html");
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
