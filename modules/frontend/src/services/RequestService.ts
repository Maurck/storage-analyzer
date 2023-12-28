
export class RequestService {
    baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    fetch = async(url: string, errorMsg: string) => {
        return await fetch(this.baseUrl + url)
            .then(async (res: Response) => {
                if (!res.ok) throw new Error(errorMsg);
                return await res.json()
            })
            .catch(err => console.log(err))
    }
}