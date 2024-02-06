import {  ID, Query } from "appwrite";
import { account, appwriteConfig, avatars, databases, storage } from "./config";
import { INewPost, INewUser, IUpdatePost } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../react-query/queryKeys";
import { getUserById } from "../react-query/queriesAndMutations";
// import { UploadCloud } from "lucide-react";
// import { error } from "console";
// import { Query } from "@tanstack/react-query";

export async function createUserAccount(user: INewUser) {
    try{
        const newAccount = await account.create(
            ID.unique(),
            user.email,
            user.password,
            user.name
        );

        if(!newAccount) throw Error;

        const avatarUrl = avatars.getInitials(user.name);

        const newUser = await saveUserToDB({
            accountId: newAccount.$id,
            email: newAccount.email, 
            name: newAccount.name,
            username: user.username,
            imageUrl: avatarUrl,
        })

        return newUser;
    } catch(error) {
        console.log(error);
        return error;
    } 
}

export async function saveUserToDB(user:{
    accountId: string;
    email: string;
    name: string;
    imageUrl: URL;
    username?: string;
}) {
    try{
        const newUser = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            ID.unique(),
            user,
        )

        return newUser;
    } catch (error) {
        console.log(error);
    }
}

export async function signInAccount(user: { email: string; password: string;}){
    try {
        const session = await account.createEmailSession(user.email, user.password);
        return session;
    }
    catch (error){
        console.log(error);
    }
}

export async function getCurrentUser() {
    try{
        const currentAccount =await account.get();
        if(!currentAccount) throw Error;
        const currentUser = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [Query.equal('accountId', currentAccount.$id)]
        )
        if(!currentUser) throw Error;

        return currentUser.documents[0];
    }
    catch(error) {
        console.log(error);
    }
}

export async function signOutAccount() {
    try {
        const session = await account.deleteSession("current")
        return session;
    } catch (error) {
        console.log(error);
    }
}

export async function createPost(post: INewPost) {
    try {
        //Upload image to storage
        const uploadedFile = await uploadFile(post.file[0]);

        if(!uploadedFile) throw Error;

        //Get file URL
        const fileUrl = await getFilePreview(uploadedFile.$id);
        console.log({fileUrl});

        if(!fileUrl) {
            deleteFile(uploadedFile.$id)
            throw Error;
        }

        //convert tags into an array
        const tags = post.tags?.replace(/ /g, "").split(",") || [];

        //save new post to database
        const newPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            ID.unique(),
            {
                creator: post.userId,
                caption: post.caption,
                imageUrl: fileUrl,
                imageId: uploadedFile.$id,
                location: post.location,
                tags: tags,
            }
        );

        if(!newPost){
            await deleteFile(uploadedFile.$id)
            throw Error;
        }
        return newPost;
    } catch (error) {
        console.log(error);
    }
}


export async function uploadFile(file: File) {
    try {
        //Upload image to storage
        const uploadedFile = await storage.createFile(
            appwriteConfig.storageId,
            ID.unique(),
            file
        );
        return uploadedFile;
    } catch (error) {
        console.log(error);
    }
}


// export async function getFilePreview(fileId: string){
//     try{
//         const fileUrl = storage.getFilePreview(
//             appwriteConfig.storageId,
//             fileId,
//             2000,
//             2000,
//             "top",
//             100,
//         )

//         return fileUrl;
//     }
//     catch(error){
//         console.log(error);
//     }
// }

export function getFilePreview(fileId: string) {
    try {
        const fileUrl = storage.getFilePreview(
            appwriteConfig.storageId,
            fileId,
            2000,
            2000,
            "top",
            100
        );

        if (!isValidUrl(fileUrl.toString())) {
            throw new Error("Invalid file URL received from storage service");
        }

        return fileUrl;
    } catch (error) {
        console.error(error);
        throw new Error("Error getting file preview");
    }
}

// Helper function to check if a string is a valid URL
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}


export async function deleteFile(fileId: string){
    try{
        await storage.deleteFile(appwriteConfig.storageId, fileId);
        return { status: 'ok' }
    }
    catch(error){
        console.log(error);
    }
}

export async function getRecentPosts() {
    const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        [Query.orderDesc('$createdAt'), Query.limit(20)]
    )

    if(!posts) throw Error;

    return posts;
}

export async function likePost(postId:string, likeArray: string[]) {
    try {
        const updatedPost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId,
            {
                likes: likeArray
            }
        )
        if(!updatedPost) throw Error;

        return updatedPost;
        
    } catch (error) {
        console.log(error)
    }
    
}

export async function savePost( postId:string, userId: string ) {
    try {
        const updatedPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            ID.unique(),
            {
                users: userId,
                post: postId,
            }
        )
        if(!updatedPost) throw Error;

        return updatedPost;
        
    } catch (error) {
        console.log(error)
    }
    
}

export async function deleteSavedPost(savedRecordId :string) {
    try {
        const statusCode = await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            savedRecordId,
        )
        if(!statusCode) throw Error;

        return statusCode;
        
    } catch (error) {
        console.log(error)
    }
    
}

export async function getPostById(postId: string){
    try {
        const post = await databases.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        postId
        )

        return post;
    } catch (error) {
        console.log(error);
    }
}

export async function updatePost(post: IUpdatePost) {
    const hasFileToUpdate = post.file.length > 0;

    try {

        let image = {
            imageUrl: post.imageUrl,
            imageId: post.imageId,
        }

        if(hasFileToUpdate){
            //Upload image to storage
            const uploadedFile = await uploadFile(post.file[0]);
            if(!uploadedFile) throw Error;
            //Get file URL
            const fileUrl = await getFilePreview(uploadedFile.$id);
            console.log({fileUrl});
    
            if(!fileUrl) {
                deleteFile(uploadedFile.$id)
                throw Error;
            }

            image = { ...image, imageUrl: fileUrl, imageId: uploadedFile.$id}
        }

        //convert tags into an array
        const tags = post.tags?.replace(/ /g, "").split(",") || [];

        //save new post to database
        const updatedPost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            post.postId,
            {
                caption: post.caption,
                imageUrl: image.imageUrl,
                imageId: image.imageId,
                location: post.location,
                tags: tags,
            }
        );

        if(!updatedPost){
            await deleteFile(post.imageId)
            throw Error;
        }
        return updatedPost;
    } catch (error) {
        console.log(error);
    }
}

export async function deletePost(postId: string, imageId: string ) {
    if(!postId || !imageId) throw Error;
    try {
        const statusCode = databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId
        )
        if (!statusCode) throw Error;
  
      await deleteFile(imageId);
  
      return { status: "Ok" };
    } catch (error) {
        console.log(error);
    }
}


export async function getInfinitePosts({ pageParam }: { pageParam:number }){
    const queries: any[] = [Query.orderDesc(`$updatedAt`), Query.limit(10)]

    if(pageParam){
        queries.push(Query.cursorAfter(pageParam.toString()));
    }

    try {
        const posts = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            queries
        )

        if(!posts) throw Error;
        return posts;
        
    } catch (error) {
        console.log(error)
    }
}

export async function searchPosts(searchTerm: string){
    try {
        const posts = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            [Query.search('caption', searchTerm)]
        )

        if(!posts) throw Error;

        return posts;
        
    } catch (error) {
        console.log(error)
    }
}

export async function getUsers(limit?: number) {
    const queries: any[] = [Query.orderDesc("$createdAt")];
  
    if (limit) {
      queries.push(Query.limit(limit));
    }
  
    try {
      const users = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        queries
      );
  
      if (!users) throw Error;
  
      return users;
    } catch (error) {
      console.log(error);
    }
}

export const useGetUserById = (userId: string) => {
    return useQuery({
      queryKey: [QUERY_KEYS.GET_USER_BY_ID, userId],
      queryFn: () => getUserById(userId),
      enabled: !!userId,
    });
  };
