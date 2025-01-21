
export const eventHandler = async (event:string): Promise<boolean> => {
    console.warn(event);
    return true;
};
