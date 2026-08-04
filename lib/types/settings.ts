export interface Permission { id:number; module:string; code:string; name:string }
export interface Role { id:number; code:string; name:string; isSystem:boolean; permissions:Permission[] }
export interface User { id:number; fullName:string; email:string; phone:string|null; roles:string[]; isActive:boolean; status:string }
export interface ApiKey { id:number; name:string; maskedKey:string; isActive:boolean; lastUsedAt:string|null; createdAt:string }
export interface CreatedApiKey { id:number; name:string; apiKey:string; createdAt:string }
export interface Session { id:number; deviceName:string|null; browser:string|null; ipAddress:string|null; createdAt:string; lastActivity:string; expiresAt:string; isCurrent:boolean }
export interface LocationChoice { id:number; code:string; name:string; isActive:boolean }
